import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllPlayers, getAttendanceByDivision } from '../../services/firestoreService';
import {
    Box, Typography, Card, CardContent, Grid, Fade, Chip, Avatar, Divider,
    List, ListItemButton, ListItemAvatar, ListItemText
} from '@mui/material';
import {
    FamilyRestroom as FamilyIcon, CheckCircle as PresentIcon, Cancel as AbsentIcon,
    AccessTime as LateIcon,
} from '@mui/icons-material';

export default function ParentDashboard() {
    const { userModel } = useAuth();
    const [children, setChildren] = useState([]);
    const [selectedChild, setSelectedChild] = useState(null);
    const [attendance, setAttendance] = useState([]);

    useEffect(() => {
        async function fetchChildren() {
            if (!userModel?.assignedPlayerIds?.length) return;
            const allPlayers = await getAllPlayers();
            const myChildren = allPlayers.filter((p) => userModel.assignedPlayerIds.includes(p.id));
            setChildren(myChildren);
            if (myChildren.length > 0) setSelectedChild(myChildren[0]);
        }
        fetchChildren();
    }, [userModel]);

    useEffect(() => {
        async function fetchAttendance() {
            if (!selectedChild) return;
            const att = await getAttendanceByDivision(selectedChild.divisionId);
            setAttendance(att.sort((a, b) => b.date - a.date));
        }
        fetchAttendance();
    }, [selectedChild]);

    const getChildStatus = (record) => {
        if (record.presentPlayerIds.includes(selectedChild?.id)) return { label: 'Presente', color: 'success', icon: <PresentIcon /> };
        if (record.absentPlayerIds.includes(selectedChild?.id)) return { label: 'Ausente', color: 'error', icon: <AbsentIcon /> };
        if (record.latePlayerIds.includes(selectedChild?.id)) return { label: 'Tarde', color: 'warning', icon: <LateIcon /> };
        return { label: 'Sin registro', color: 'default', icon: null };
    };

    const typeLabels = { training: 'Entrenamiento', match: 'Partido' };

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight={800}>
                        ¡Hola, {userModel?.name?.split(' ')[0]}! 👨‍👧‍👦
                    </Typography>
                    <Typography variant="body1" color="text.secondary">Panel de Padre/Madre</Typography>
                </Box>

                {children.length > 0 ? (
                    <Grid container spacing={3}>
                        {/* Children list */}
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" fontWeight={700} gutterBottom>Mis Hijos</Typography>
                                    <List>
                                        {children.map((child) => (
                                            <ListItemButton
                                                key={child.id}
                                                selected={selectedChild?.id === child.id}
                                                onClick={() => setSelectedChild(child)}
                                                sx={{ borderRadius: 2, mb: 0.5 }}
                                            >
                                                <ListItemAvatar>
                                                    <Avatar sx={{ bgcolor: selectedChild?.id === child.id ? 'primary.main' : 'grey.400' }}>
                                                        {child.name?.charAt(0)}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText primary={child.name} secondary={`DNI: ${child.dni}`} />
                                            </ListItemButton>
                                        ))}
                                    </List>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Attendance */}
                        <Grid size={{ xs: 12, md: 8 }}>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                Asistencia de {selectedChild?.name}
                            </Typography>
                            {attendance.map((record) => {
                                const status = getChildStatus(record);
                                return (
                                    <Card key={record.id} sx={{ mb: 1.5 }}>
                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Box>
                                                <Typography variant="body1" fontWeight={600}>
                                                    {record.date.toLocaleDateString('es-AR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                </Typography>
                                                <Chip label={typeLabels[record.type] || record.type} size="small" variant="outlined" />
                                            </Box>
                                            <Chip icon={status.icon} label={status.label} color={status.color} />
                                        </CardContent>
                                    </Card>
                                );
                            })}
                            {attendance.length === 0 && (
                                <Card><CardContent><Typography color="text.secondary">Sin registros de asistencia.</Typography></CardContent></Card>
                            )}
                        </Grid>
                    </Grid>
                ) : (
                    <Card><CardContent><Typography color="text.secondary">No tenés hijos asignados.</Typography></CardContent></Card>
                )}
            </Box>
        </Fade>
    );
}
