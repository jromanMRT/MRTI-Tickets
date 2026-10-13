import { render, screen } from '@testing-library/react';
import Tickets from './Tickets';
import { TestWrapper } from '../test-utils';

test('renders tickets heading', () => {
  render(<Tickets />, { wrapper: TestWrapper });
  expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument();
});
