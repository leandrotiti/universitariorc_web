import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUser as updateUserFirestore } from '../services/firestoreService';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, updateDoc, getDocs, query, collection, where } from 'firebase/firestore';
import {
    Box, Typography, Card, CardContent, TextField, Button, Grid, Snackbar, Alert,
    Fade, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
    InputAdornment, IconButton
} from '@mui/material';
import {
    Save as SaveIcon, Lock as LockIcon, Visibility, VisibilityOff, Add as AddIcon
} from '@mui/icons-material';
import { getRoleLabel, getDisplayName } from '../models/UserModel';
import AddressDialog from '../components/shared/AddressDialog';
import { AddressModel } from '../models/AddressModel';

export default function ProfilePage() {
    const { userModel } = useAuth();
    const [formData, setFormData] = useState({
        name: userModel?.name || '',
        nickname: userModel?.nickname || '',
        username: userModel?.username || '',
        phone: userModel?.phone || '',
        dni: userModel?.dni || '',
        obraSocial: userModel?.obraSocial || '',
        emergencyContactName: userModel?.emergencyContactName || '',
        emergencyContactPhone: userModel?.emergencyContactPhone || '',
        birthDate: userModel?.birthDate ? userModel.birthDate.toISOString().split('T')[0] : '',
    });
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [passwordDialog, setPasswordDialog] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [addressOpen, setAddressOpen] = useState(false);
    const [playerAddress, setPlayerAddress] = useState(null);

    useEffect(() => {
        if (userModel?.addressId) {
            getDocs(query(collection(db, 'addresses'), where('__name__', '==', userModel.addressId))).then(snap => {
                if (!snap.empty) {
                    setPlayerAddress(AddressModel.fromMap(snap.docs[0].data(), snap.docs[0].id));
                }
            }).catch(e => console.error("Error loading address:", e));
        }
    }, [userModel?.addressId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            let addressId = userModel?.addressId || null;
            if (playerAddress) {
                if (addressId) {
                    await updateDoc(doc(db, 'addresses', addressId), playerAddress.toMap());
                } else {
                    const docRef = doc(collection(db, 'addresses'));
                    addressId = docRef.id;
                    playerAddress.id = addressId;
                    await setDoc(docRef, playerAddress.toMap());
                }
            }

            const nameLower = formData.name.trim().toLowerCase();
            const nicknameLower = formData.nickname.trim().toLowerCase();
            const keywords = [
                nameLower, 
                ...nameLower.split(' '), 
                userModel.email.toLowerCase(), 
                formData.dni.trim(),
            ];
            if (nicknameLower) {
                keywords.push(nicknameLower);
                keywords.push(...nicknameLower.split(' '));
            }

            await updateUserFirestore({
                ...userModel,
                name: formData.name.trim(),
                nickname: formData.nickname.trim(),
                username: formData.username.trim(),
                phone: formData.phone.trim(),
                dni: formData.dni.trim(),
                obraSocial: formData.obraSocial.trim(),
                emergencyContactName: formData.emergencyContactName.trim(),
                emergencyContactPhone: formData.emergencyContactPhone.trim(),
                birthDate: formData.birthDate ? new Date(formData.birthDate) : null,
                addressId: addressId,
                keywords: keywords
            });
            setSnackbar({ open: true, message: 'Perfil actualizado', severity: 'success' });
        } catch (error) {
            console.error("Save error:", error);
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
                                <Typography variant="h5" fontWeight={700}>{getDisplayName(userModel)}</Typography>
                                <Typography color="text.secondary" gutterBottom>@{userModel?.username}</Typography>
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
                                        <TextField fullWidth label="Nombre y Apellido" value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="Apodo (Opcional)" value={formData.nickname}
                                            onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} />
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
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="Fecha de Nacimiento" type="date" value={formData.birthDate}
                                            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} 
                                            InputLabelProps={{ shrink: true }} />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            <Button variant="outlined" onClick={() => setAddressOpen(true)} startIcon={<AddIcon />} sx={{ alignSelf: 'flex-start' }}>
                                                {playerAddress ? 'Editar Dirección' : 'Cargar Dirección'}
                                            </Button>
                                            {playerAddress && (
                                                <Typography variant="caption" color="text.secondary">
                                                    {playerAddress.calle} {playerAddress.numero}{playerAddress.departamento ? ` Dpto: ${playerAddress.departamento}` : ''}, {playerAddress.localidad}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="Obra Social (Opcional)" value={formData.obraSocial}
                                            onChange={(e) => setFormData({ ...formData, obraSocial: e.target.value })} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="Contacto Emerg. (Nombre) (Opcional)" value={formData.emergencyContactName}
                                            onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField fullWidth label="Contacto Emerg. (Teléfono) (Opcional)" value={formData.emergencyContactPhone}
                                            onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })} />
                                    </Grid>
                                </Grid>
                                <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
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

                <AddressDialog
                    open={addressOpen}
                    initialAddress={playerAddress}
                    onClose={() => setAddressOpen(false)}
                    onSave={(addr) => setPlayerAddress(addr)}
                />

                <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                    <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
                </Snackbar>
            </Box>
        </Fade>
    );
}
