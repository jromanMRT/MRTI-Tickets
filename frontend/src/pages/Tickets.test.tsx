import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Tickets from './Tickets';

test('renders tickets heading', () => {
  render(
    <BrowserRouter>
      <Tickets />
    </BrowserRouter>
  );
  expect(screen.getByText(/Tickets/i)).toBeInTheDocument();
});
