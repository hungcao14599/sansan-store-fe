import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';

type Props = {
  children: JSX.Element;
};

export function AuthGuard({ children }: Props) {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
