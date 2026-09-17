import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./routes/AppRouter', () => ({
  AppRouter: () => <div>Application router</div>,
}));

test('renders the application router', () => {
  render(<App />);
  expect(screen.getByText('Application router')).toBeInTheDocument();
});
