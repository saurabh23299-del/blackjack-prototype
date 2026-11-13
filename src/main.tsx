import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutGroup } from 'framer-motion';
import { Stage } from './ui/Stage';
import { Table } from './ui/Table';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Stage>{H => <LayoutGroup><Table H={H} /></LayoutGroup>}</Stage>
  </StrictMode>,
);
