import { Box, Typography, Card, CardContent, Fade } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

export default function PlayerDashboard() {
    const { userModel } = useAuth();

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight={800}>
                        ¡Hola, {userModel?.name?.split(' ')[0]}! 🏃
                    </Typography>
                    <Typography variant="body1" color="text.secondary">Panel de Jugador</Typography>
                </Box>
                <Card>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" fontWeight={700} gutterBottom>Bienvenido</Typography>
                        <Typography color="text.secondary">
                            Acá podés ver tu información y actividades.
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        </Fade>
    );
}
