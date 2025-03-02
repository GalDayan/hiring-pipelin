import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'data.json');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      res.status(200).json(JSON.parse(data));
    } else {
      res.status(200).json({ nodes: [], links: [] });
    }
  } else if (req.method === 'POST') {
    const data = req.body;
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
    res.status(200).json({ message: 'Data saved' });
  } else {
    res.status(405).end();
  }
}
