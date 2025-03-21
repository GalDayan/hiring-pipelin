// pages/index.tsx
import dynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';

// Dynamically import React Flow and its Provider with SSR disabled.
const ReactFlow = dynamic(
  () => import('reactflow').then((mod) => mod.ReactFlow),
  { ssr: false }
);
const ReactFlowProvider = dynamic(
  () => import('reactflow').then((mod) => mod.ReactFlowProvider),
  { ssr: false }
);
import 'reactflow/dist/style.css';

interface Person {
  id: string;
  name: string;
  status: string;
  starred: boolean;
  team: string;
  notes: string;
  x?: number;
  y?: number;
}

interface Link {
  source: string;
  target: string;
}

interface DataStructure {
  nodes: Person[];
  links: Link[];
}

interface NewNodeInput {
  name: string;
  status: string;
  starred: boolean;
  team: string;
}

const initialNodes: Person[] = [];
const initialLinks: Link[] = [];

const statusColors: { [key: string]: string } = {
  'To do': '#3498db',
  Interview: '#e67e22',
  CEO: '#2ecc71',
  Rejected: '#e74c3c',
};

const Home: React.FC = () => {
  const [nodes, setNodes] = useState<Person[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [newNode, setNewNode] = useState<NewNodeInput>({
    name: '',
    status: 'To do',
    starred: false,
    team: '',
  });
  const [connection, setConnection] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterStarred, setFilterStarred] = useState<boolean>(false);
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [teamOption, setTeamOption] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  // Child person form (added in the modal)
  const [childName, setChildName] = useState('');
  const [childStatus, setChildStatus] = useState('To do');
  const [childStarred, setChildStarred] = useState(false);

  // State for dynamic graph dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    // Set dimensions on mount and on resize
    const handleResize = () => {
      // subtract some padding if needed (here 40px total)
      setDimensions({ width: window.innerWidth - 40, height: 600 });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load persisted data on mount.
  useEffect(() => {
    async function loadData() {
      const res = await fetch('/api/data');
      const data: DataStructure = await res.json();
      setNodes(data.nodes || []);
      setLinks(data.links || []);
    }
    loadData();
  }, []);

  // Save updated data via API.
  const saveData = async (updatedNodes: Person[], updatedLinks: Link[]) => {
    const payload: DataStructure = { nodes: updatedNodes, links: updatedLinks };
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  // -----------------------
  // 1) Add a new person (top form)
  // -----------------------
  const addNode = async () => {
    if (!newNode.name) return;
    const id = (nodes.length + 1).toString();
    const nodeToAdd: Person = { ...newNode, id, notes: '' };
    const updatedNodes = [...nodes, nodeToAdd];
    let updatedLinks = [...links];
    if (connection) {
      updatedLinks.push({ source: connection, target: id });
    }
    setNodes(updatedNodes);
    setLinks(updatedLinks);
    setNewNode({ name: '', status: 'To do', starred: false, team: '' });
    setTeamOption('');
    setConnection('');
    await saveData(updatedNodes, updatedLinks);
  };

  // -----------------------
  // 2) Update selected person (quick edit modal)
  // -----------------------
  const updatePerson = async () => {
    if (!selectedPerson) return;
    const updatedNodes = nodes.map((node) =>
      node.id === selectedPerson.id ? selectedPerson : node
    );
    setNodes(updatedNodes);
    await saveData(updatedNodes, links);
    setSelectedPerson(null);
  };

  // -----------------------
  // 3) Add child person (no team) linked to the selected person
  // -----------------------
  const addChildPerson = async () => {
    if (!selectedPerson || !childName) return;
    const id = (nodes.length + 1).toString();
    const newChild: Person = {
      id,
      name: childName,
      status: childStatus,
      starred: childStarred,
      team: '',
      notes: '',
    };
    const updatedNodes = [...nodes, newChild];
    const updatedLinks = [...links, { source: selectedPerson.id, target: id }];
    setNodes(updatedNodes);
    setLinks(updatedLinks);

    // Reset child form
    setChildName('');
    setChildStatus('To do');
    setChildStarred(false);

    await saveData(updatedNodes, updatedLinks);
  };

  // -----------------------
  // 4) Delete selected person
  // -----------------------
  const deletePerson = async () => {
    if (!selectedPerson) return;
    const updatedNodes = nodes.filter((n) => n.id !== selectedPerson.id);
    const updatedLinks = links.filter(
      (l) => l.source !== selectedPerson.id && l.target !== selectedPerson.id
    );
    setNodes(updatedNodes);
    setLinks(updatedLinks);
    setSelectedPerson(null);
    await saveData(updatedNodes, updatedLinks);
  };

  // -----------------------
  // Filtering
  // -----------------------
  const filteredNodes = nodes.filter((node) => {
    const statusMatch = filterStatus ? node.status === filterStatus : true;
    const starredMatch = filterStarred ? node.starred === true : true;
    const teamMatch = filterTeam ? node.team === filterTeam : true;
    return statusMatch && starredMatch && teamMatch;
  });
  const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));
  const filteredLinks = links.filter(
    (link) => filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
  );

  // -----------------------
  // Build Team Grouping (for team nodes)
  // -----------------------
  const teamNodesMap = new Map<string, { id: string; label: string }>();
  filteredNodes.forEach((node) => {
    if (node.team) {
      if (!teamNodesMap.has(node.team)) {
        teamNodesMap.set(node.team, { id: `team_${node.team}`, label: node.team });
      }
    }
  });

  const yPositions = [50, 450, 850]; // Extend if you have more rows
  const teamNodesArray = Array.from(teamNodesMap.values());
  const TEAMS_IN_A_ROW = 3;
  const pinnedTeamNodes = teamNodesArray.map((teamNode, index) => {
    const row = Math.floor(index / TEAMS_IN_A_ROW);
    return {
      ...teamNode,
      color: '#9b59b6',
      size: 600,
      fx: (index % TEAMS_IN_A_ROW + 1) * 800, // fixed horizontal position
      fy: yPositions[row] || 0, // fixed vertical position from lookup
      static: true,
    };
  });

  // Create links from each team node to its members.
  const teamLinks: Link[] = [];
  filteredNodes.forEach((node) => {
    if (node.team) {
      teamLinks.push({ source: `team_${node.team}`, target: node.id });
    }
  });

  // Build a lookup for team positions using pinnedTeamNodes.
  const teamPositions = new Map<string, { x: number; y: number }>();
  pinnedTeamNodes.forEach((teamNode) => {
    teamPositions.set(teamNode.label, { x: teamNode.fx, y: teamNode.fy });
  });

  // -----------------------
  // Build person nodes with a clean layout.
  // We'll group persons by team and arrange each team's persons in a circle around the team node.
  // -----------------------
  const graphPersonNodes: any[] = [];
  const teamGroups = new Map<string, Person[]>();

  // Group persons with a team that has a defined team position.
  filteredNodes.forEach((node) => {
    if (node.team && teamPositions.has(node.team)) {
      if (!teamGroups.has(node.team)) {
        teamGroups.set(node.team, []);
      }
      teamGroups.get(node.team)!.push(node);
    } else {
      // For nodes with no team or no team position, use stored positions (or default to 0,0)
      const nodeLabel = node.starred ? `${node.name} ⭐` : node.name;
      graphPersonNodes.push({
        id: node.id,
        label: nodeLabel,
        color: statusColors[node.status],
        opacity: node.status === 'Rejected' ? 0.4 : 1,
        x: node.x !== undefined ? node.x : 0,
        y: node.y !== undefined ? node.y : 0,
      });
    }
  });

  // For each team, arrange its persons in a circle around the team node.
  teamGroups.forEach((nodesInTeam, teamName) => {
    const teamPos = teamPositions.get(teamName)!;
    const numNodes = nodesInTeam.length;
    const radius = 200; // Adjust radius as needed for spacing

    nodesInTeam.forEach((node, i) => {
      // Evenly distribute nodes around a circle.
      const angle = (2 * Math.PI * i) / numNodes;
      const x = teamPos.x + radius * Math.cos(angle);
      const y = teamPos.y + radius * Math.sin(angle);
      const nodeLabel = node.starred ? `${node.name} ⭐` : node.name;

      graphPersonNodes.push({
        id: node.id,
        label: nodeLabel,
        color: statusColors[node.status],
        opacity: node.status === 'Rejected' ? 0.4 : 1,
        x,
        y,
      });
    });
  });

  // Merge person nodes & pinned team nodes.
  const graphNodes = [...graphPersonNodes, ...pinnedTeamNodes];
  const graphLinks = [...filteredLinks, ...teamLinks];

  // -----------------------
  // Map graph data to React Flow's format.
  // -----------------------
  const rfNodes = graphNodes.map((node) => {
    const x = node.x !== undefined ? node.x : node.fx ?? 0;
    const y = node.y !== undefined ? node.y : node.fy ?? 0;
    return {
      id: node.id,
      position: { x, y },
      data: { label: node.label },
      style: { background: node.color, opacity: node.opacity },
      // Make team nodes non-draggable.
      draggable: !node.id.startsWith('team_'),
    };
  });

  // Map links to React Flow edges.
  // If an edge leads to a starred node, mark it as animated.
  const rfEdges = graphLinks.map((edge, index) => {
    const targetNode = nodes.find((n) => n.id === edge.target);
    return {
      id: `e-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      animated: targetNode?.starred || false,
    };
  });

  // -----------------------
  // Handlers for React Flow events.
  // -----------------------
  const handleNodePositionChange = (nodeId: string, x: number, y: number) => {
    // Ignore team nodes (or any node not present in your state)
    if (!nodes.some((n) => n.id === nodeId)) return;
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n))
    );
  };

  const onNodeDragStop = (_: any, node: any) => {
    handleNodePositionChange(node.id, node.position.x, node.position.y);
  };

  const handleNodeClick = (nodeId: string) => {
    if (nodeId.startsWith('team_')) return;
    const person = nodes.find((node) => node.id === nodeId);
    if (person) {
      setSelectedPerson({ ...person });
      // Reset child form fields.
      setChildName('');
      setChildStatus('To do');
      setChildStarred(false);
    }
  };

  const onNodeClick = (_: any, node: any) => {
    if (node.id.startsWith('team_')) return;
    handleNodeClick(node.id);
  };

  // Generate team options for the top form.
  const teamOptionsList = Array.from(
    new Set(nodes.map((node) => node.team).filter((team) => team !== ''))
  );

  // Calculate status stats
  const statusStats = Object.keys(statusColors).reduce((acc, status) => {
    acc[status] = nodes.filter(node => node.status === status).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>Hiring Pipeline Manager</h1>

      {/* Combined Add & Filter Section */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          justifyContent: 'center',
          marginBottom: '20px',
        }}
      >
        {/* Add New Person Form */}
        <div
          style={{
            flex: '1 1 300px',
            padding: '20px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <h2>Add New Person</h2>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Name</label>
            <input
              type="text"
              placeholder="Name"
              value={newNode.name}
              onChange={(e) => setNewNode({ ...newNode, name: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Team</label>
            <select
              value={teamOption}
              onChange={(e) => {
                const val = e.target.value;
                setTeamOption(val);
                if (val !== 'other') {
                  setNewNode({ ...newNode, team: val });
                } else {
                  setNewNode({ ...newNode, team: '' });
                }
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                marginBottom: '5px',
              }}
            >
              <option value="">None</option>
              {teamOptionsList.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
            {teamOption === 'other' && (
              <input
                type="text"
                placeholder="Enter new team"
                value={newNode.team}
                onChange={(e) => setNewNode({ ...newNode, team: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                }}
              />
            )}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Status</label>
            <select
              value={newNode.status}
              onChange={(e) => setNewNode({ ...newNode, status: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            >
              {Object.keys(statusColors).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={newNode.starred}
                onChange={(e) => setNewNode({ ...newNode, starred: e.target.checked })}
                style={{ marginRight: '5px' }}
              />
              Starred
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Connect To</label>
            <select
              value={connection}
              onChange={(e) => setConnection(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            >
              <option value="">None</option>
              {nodes.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={addNode}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#3498db',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add Person
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            flex: '1 1 300px',
            padding: '20px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <h2>Filters</h2>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ marginRight: '10px' }}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            >
              <option value="">All</option>
              {Object.keys(statusColors).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ marginRight: '10px' }}>Team</label>
            <input
              type="text"
              placeholder="Filter by team"
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div>
            <label>
              <input
                type="checkbox"
                checked={filterStarred}
                onChange={(e) => setFilterStarred(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Starred Only
            </label>
          </div>

          {/* Status Statistics */}
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ marginBottom: '15px' }}>Pipeline Statistics</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {Object.entries(statusStats).map(([status, count]) => (
                <div
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    backgroundColor: `${statusColors[status]}20`,
                    border: `2px solid ${statusColors[status]}`,
                    minWidth: '100px',
                    cursor: 'pointer',
                    opacity: filterStatus === status ? 1 : 0.7,
                    transform: filterStatus === status ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{count}</div>
                  <div style={{ color: '#666' }}>{status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Graph Display using React Flow */}
      <div
        style={{
          width: '100%',
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflowX: 'auto',
        }}
      >
        <ReactFlowProvider>
          <div style={{ width: dimensions.width, height: dimensions.height }}>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={onNodeClick}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </ReactFlowProvider>
      </div>

      {/* Quick Edit & Add Child Person Modal */}
      {selectedPerson && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedPerson(null)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              minWidth: '320px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Edit {selectedPerson.name}</h2>
            {/* Quick Edit Fields */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Status</label>
              <select
                value={selectedPerson.status}
                onChange={(e) =>
                  setSelectedPerson({ ...selectedPerson, status: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                }}
              >
                {Object.keys(statusColors).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ marginRight: '5px' }}>
                <input
                  type="checkbox"
                  checked={selectedPerson.starred}
                  onChange={(e) =>
                    setSelectedPerson({ ...selectedPerson, starred: e.target.checked })
                  }
                  style={{ marginRight: '5px' }}
                />
                Starred
              </label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Notes</label>
              <textarea
                value={selectedPerson.notes}
                onChange={(e) =>
                  setSelectedPerson({ ...selectedPerson, notes: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  minHeight: '60px',
                }}
              />
            </div>

            {/* Edit, Delete Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button
                onClick={() => setSelectedPerson(null)}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#ccc',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={updatePerson}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#3498db',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                onClick={deletePerson}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#e74c3c',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>

            <hr style={{ margin: '20px 0' }} />

            {/* Add a child person (linked to selectedPerson, no team) */}
            <h3>Add Child Person (Linked to {selectedPerson.name})</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Name</label>
              <input
                type="text"
                placeholder="Child Name"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Status</label>
              <select
                value={childStatus}
                onChange={(e) => setChildStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                }}
              >
                {Object.keys(statusColors).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>
                <input
                  type="checkbox"
                  checked={childStarred}
                  onChange={(e) => setChildStarred(e.target.checked)}
                  style={{ marginRight: '5px' }}
                />
                Starred
              </label>
            </div>
            <button
              onClick={addChildPerson}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#2ecc71',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Add Child Person
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
