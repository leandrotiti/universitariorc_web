import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

export default function ProtectedRoute({ children, allowedRoles }) {
    const { userModel, loading } = useAuth();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress color="primary" size={48} />
            </Box>
        );
    }

    if (!userModel) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && allowedRoles.length > 0) {
        const hasAccess = userModel.roles.some((r) => allowedRoles.includes(r));
        if (!hasAccess) {
            return <Navigate to="/login" replace />;
        }
    }

    return children;
}
