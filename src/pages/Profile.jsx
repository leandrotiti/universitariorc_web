import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUser as updateUserFirestore } from '../services/firestoreService';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';
import {
    Box, Typography, Card, CardContent, TextField, Button, Grid, Snackbar, Alert,
    Fade, Avatar, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
    InputAdornment, IconButton
} from '@mui/material';
import {
    Save as SaveIcon, Lock as LockIcon, Visibility, VisibilityOff,
} from '@mui/icons-material';
import { getRoleLabel } from '../models/UserModel';

export default function ProfilePage() {
    const { userModel } = useAuth();
    const [formData, setFormData] = useState({
        name: userModel?.name || '',
        username: userModel?.username || '',
        phone: userModel?.phone || '',
        dni: userModel?.dni || '',
    });
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [passwordDialog, setPasswordDialog] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateUserFirestore({
                ...userModel,
                name: formData.name,
                username: formData.username,
                phone: formData.phone,
                dni: formData.dni,
            });
            setSnackbar({ open: true, message: 'Perfil actualizado', severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: 'Error al actualizar', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordForm.new !== passwordForm.confirm) {
            setSnackbar({ open: true, message: 'Las contraseñas no coinciden', severity: 'error' });
            return;
        }
        if (passwordForm.new.length < 6) {
            setSnackbar({ open: true, message: 'La contraseña debe tener al menos 6 caracteres', severity: 'error' });
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordForm.current);
            await reauthenticateWithCredential(auth.currentUser, credential);
            await updatePassword(auth.currentUser, passwordForm.new);
            setPasswordDialog(false);
            setPasswordForm({ current: '', new: '', confirm: '' });
            setSnackbar({ open: true, message: 'Contraseña cambiada correctamente', severity: 'success' });
        } catch (error) {
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setSnackbar({ open: true, message: 'Contraseña actual incorrecta', severity: 'error' });
            } else {
                setSnackbar({ open: true, message: 'Error al cambiar contraseña', severity: 'error' });
            }
        }
    };

    return (
        <Fade in timeout={400}>
            <Box>
                <Typography variant="h4" fontWeight={800} gutterBottom>Mi Perfil</Typography>

                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Card sx={{ textAlign: 'center' }}>
                            <CardContent sx={{ p: 4 }}>
                                <Avatar sx={{
                                    width: 100, height: 100, fontSize: '2.5rem', mx: 'auto', mb: 2,
                                    bgcolor: 'primary.main', boxShadow: '0 4px 14px rgba(27, 94, 32, 0.4)',
                                }}>
                                    {userModel?.name?.charAt(0)?.toUpperCase()}
                                </Avatar>
                                <Typography variant="h5" fontWeight={700}>{userModel?.name}</Typography>
                                <Typography color="text.secondary" gutterBottom>{userModel?.email}</Typography>
                                <Typography variant="body2" fontWeight={600} color="primary.main">
                                    {getRoleLabel(userModel)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, md: 8 }}>
                        <Card>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" fontWeight={700} gutterBottom>Datos Personales</Typography>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="Nombre" value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="Nombre de usuario" value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="DNI" value={formData.dni}
                                            onChange={(e) => setFormData({ ...formData, dni: e.target.value })} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="Teléfono" value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="Email" value={userModel?.email} disabled />
                                    </Grid>
                                </Grid>
                                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                                    <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
                                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                                    </Button>
                                    <Button variant="outlined" startIcon={<LockIcon />} onClick={() => setPasswordDialog(true)}>
                                        Cambiar Contraseña
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Password Dialog */}
                <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ fontWeight: 700 }}>Cambiar Contraseña</DialogTitle>
                    <DialogContent>
                        {['current', 'new', 'confirm'].map((field) => (
                            <TextField
                                key={field}
                                fullWidth
                                margin="normal"
                                label={field === 'current' ? 'Contraseña actual' : field === 'new' ? 'Nueva contraseña' : 'Confirmar nueva contraseña'}
                                type={showPasswords[field] ? 'text' : 'password'}
                                value={passwordForm[field]}
                                onChange={(e) => setPasswordForm({ ...passwordForm, [field]: e.target.value })}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] })}>
                                                {showPasswords[field] ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        ))}
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setPasswordDialog(false)}>Cancelar</Button>
                        <Button variant="contained" onClick={handleChangePassword}>Cambiar</Button>
                    </DialogActions>
                </Dialog>

                <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                    <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
                </Snackbar>
            </Box>
        </Fade>
    );
}
