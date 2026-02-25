import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
    Box, Typography, Card, CardContent, Grid, Fade, Avatar
} from '@mui/material';
import {
    People, Groups, ViewModule, Assessment
} from '@mui/icons-material';

export default function AdminDashboard() {
    const { userModel } = useAuth();
    const navigate = useNavigate();
    const [userCount, setUserCount] = useState(0);
    const [divisionCount, setDivisionCount] = useState(0);
    const [blockCount, setBlockCount] = useState(0);
    const [playerCount, setPlayerCount] = useState(0);

    useEffect(() => {
        const unsubs = [];
        unsubs.push(onSnapshot(collection(db, 'users'), s => setUserCount(s.size)));
        unsubs.push(onSnapshot(collection(db, 'divisions'), s => setDivisionCount(s.size)));
        unsubs.push(onSnapshot(collection(db, 'blocks'), s => setBlockCount(s.size)));
        unsubs.push(onSnapshot(collection(db, 'players'), s => setPlayerCount(s.size)));
        return () => unsubs.forEach(u => u());
    }, []);

    const stats = [
        { label: 'Usuarios', value: userCount, icon: <People />, color: '#1e88e5', path: '/admin/users' },
        { label: 'Divisiones', value: divisionCount, icon: <Groups />, color: '#43a047', path: '/admin/divisions' },
        { label: 'Jugadores', value: playerCount, icon: <People />, color: '#8e24aa', path: '/admin/divisions' },
        { label: 'Bloques', value: blockCount, icon: <ViewModule />, color: '#fb8c00', path: '/admin/blocks' },
    ];

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight={800}>
                        ¡Hola, {userModel?.name?.split(' ')[0]}! 🏆
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Panel de Administración
                    </Typography>
                </Box>
                <Grid container spacing={3}>
                    {stats.map(s => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={s.label}>
                            <Card
                                onClick={() => navigate(s.path)}
                                sx={{
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
                                }}
                            >
                                <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Avatar sx={{ bgcolor: s.color, width: 56, height: 56 }}>{s.icon}</Avatar>
                                    <Box>
                                        <Typography variant="h4" fontWeight={800}>{s.value}</Typography>
                                        <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </Fade>
    );
}
