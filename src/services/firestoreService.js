import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, addDoc, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../config/firebase';
import { userModelFromMap, userModelToMap } from '../models/UserModel';
import { divisionModelFromMap, divisionModelToMap } from '../models/DivisionModel';
import { playerModelFromMap, playerModelToMap } from '../models/PlayerModel';
import { attendanceModelFromMap, attendanceModelToMap } from '../models/AttendanceModel';
import { blockModelFromMap, blockModelToMap } from '../models/BlockModel';
import { notificationModelFromMap, notificationModelToMap } from '../models/NotificationModel';

// ============== USER SERVICES ==============

export async function getAllUsers() {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map((d) => userModelFromMap(d.data()));
}

export async function getUsersByRole(role) {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs
        .map((d) => userModelFromMap(d.data()))
        .filter((u) => u.roles.includes(role));
}

export async function getUserById(userId) {
    const docSnap = await getDoc(doc(db, 'users', userId));
    if (docSnap.exists()) {
        return userModelFromMap(docSnap.data());
    }
    return null;
}

export async function updateUser(user) {
    await updateDoc(doc(db, 'users', user.id), userModelToMap(user));
}

export async function deleteUser(userId) {
    // Delete the user document
    await deleteDoc(doc(db, 'users', userId));
    // Delete any associated player records
    const q = query(collection(db, 'players'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
}

export async function createUserInFirestore(userData) {
    await setDoc(doc(db, 'users', userData.id), userModelToMap(userData));
}

export function subscribeToUsers(callback) {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
        const users = snapshot.docs.map((d) => userModelFromMap(d.data()));
        callback(users);
    });
}

// ============== DIVISION SERVICES ==============

export async function getAllDivisions() {
    const snapshot = await getDocs(collection(db, 'divisions'));
    return snapshot.docs.map((d) => divisionModelFromMap(d.data()));
}

export async function createDivision(divisionData) {
    const docRef = doc(collection(db, 'divisions'));
    const division = { ...divisionData, id: docRef.id };
    await setDoc(docRef, divisionModelToMap(division));
    return division;
}

export async function updateDivision(division) {
    await updateDoc(doc(db, 'divisions', division.id), divisionModelToMap(division));
}

export async function deleteDivision(divisionId) {
    await deleteDoc(doc(db, 'divisions', divisionId));
}

export function subscribeToDivisions(callback) {
    return onSnapshot(collection(db, 'divisions'), (snapshot) => {
        const divisions = snapshot.docs.map((d) => divisionModelFromMap(d.data()));
        callback(divisions);
    });
}

// ============== PLAYER SERVICES ==============

export async function getPlayersByDivision(divisionId) {
    const q = query(collection(db, 'players'), where('divisionId', '==', divisionId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => playerModelFromMap(d.data()));
}

export async function getAllPlayers() {
    const snapshot = await getDocs(collection(db, 'players'));
    return snapshot.docs.map((d) => playerModelFromMap(d.data()));
}

export async function createPlayer(playerData) {
    const docRef = doc(collection(db, 'players'));
    const player = { ...playerData, id: docRef.id };
    await setDoc(docRef, playerModelToMap(player));
    return player;
}

export async function updatePlayer(player) {
    await updateDoc(doc(db, 'players', player.id), playerModelToMap(player));
}

export async function deletePlayer(playerId) {
    const playerRef = doc(db, 'players', playerId);
    const snap = await getDoc(playerRef);
    if (!snap.exists()) return;
    
    const playerData = snap.data();

    // Restricción: No permitir borrar si el jugador tiene asistencias
    if (playerData.divisionId) {
        const attQuery = query(collection(db, 'attendance'), where('divisionId', '==', playerData.divisionId));
        const attSnap = await getDocs(attQuery);
        
        const hasAttendance = attSnap.docs.some(d => {
            const data = d.data();
            return (data.presentPlayerIds || []).includes(playerId) || 
                   (data.absentPlayerIds || []).includes(playerId) || 
                   (data.latePlayerIds || []).includes(playerId);
        });

        if (hasAttendance) {
            throw new Error('No se puede eliminar el jugador porque tiene registros de asistencia asociados en su división histórica.');
        }
    }

    await deleteDoc(playerRef);

    if (playerData.userId) {
        const userRef = doc(db, 'users', playerData.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const roles = userData.roles || [];
            if (roles.length <= 1 && roles.includes('player')) {
                // User only has the 'player' role, so safely delete the entire user
                await deleteDoc(userRef);
            } else if (roles.includes('player')) {
                // User has multiple roles, just remove the 'player' role
                const newRoles = roles.filter(r => r !== 'player');
                await updateDoc(userRef, {
                    roles: newRoles,
                    role: newRoles[0] || 'user',
                    assignedDivisionId: null
                });
            }
        }
    }
}

export function subscribeToPlayers(divisionId, callback) {
    const q = query(collection(db, 'players'), where('divisionId', '==', divisionId));
    return onSnapshot(q, (snapshot) => {
        const players = snapshot.docs.map((d) => playerModelFromMap(d.data()));
        callback(players);
    });
}

// ============== ATTENDANCE SERVICES ==============

export async function getAttendanceByDivision(divisionId) {
    const q = query(collection(db, 'attendance'), where('divisionId', '==', divisionId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => attendanceModelFromMap(d.data()));
}

export async function createAttendance(attendanceData) {
    const docRef = doc(collection(db, 'attendance'));
    const attendance = { ...attendanceData, id: docRef.id };
    await setDoc(docRef, attendanceModelToMap(attendance));
    return attendance;
}

export async function updateAttendance(attendance) {
    await updateDoc(doc(db, 'attendance', attendance.id), attendanceModelToMap(attendance));
}

export async function deleteAttendance(attendanceId) {
    await deleteDoc(doc(db, 'attendance', attendanceId));
}

export function subscribeToAttendance(divisionId, callback) {
    const q = query(collection(db, 'attendance'), where('divisionId', '==', divisionId));
    return onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map((d) => attendanceModelFromMap(d.data()));
        callback(records);
    });
}

// ============== BLOCK SERVICES ==============

export async function getAllBlocks() {
    const snapshot = await getDocs(collection(db, 'blocks'));
    return snapshot.docs.map((d) => blockModelFromMap(d.data()));
}

export async function createBlock(blockData) {
    const docRef = doc(collection(db, 'blocks'));
    const block = { ...blockData, id: docRef.id };
    await setDoc(docRef, blockModelToMap(block));
    return block;
}

export async function updateBlock(block) {
    await updateDoc(doc(db, 'blocks', block.id), blockModelToMap(block));
}

export async function deleteBlock(blockId) {
    await deleteDoc(doc(db, 'blocks', blockId));
}

export function subscribeToBlocks(callback) {
    return onSnapshot(collection(db, 'blocks'), (snapshot) => {
        const blocks = snapshot.docs.map((d) => blockModelFromMap(d.data()));
        callback(blocks);
    });
}

// ============== NOTIFICATION SERVICES ==============

export async function createNotification(notifData) {
    const docRef = doc(collection(db, 'notifications'));
    const notif = { ...notifData, id: docRef.id };
    await setDoc(docRef, notificationModelToMap(notif));
    return notif;
}

export function subscribeToActiveNotifications(callback) {
    const nowISO = new Date().toISOString();
    const q = query(collection(db, 'notifications'), where('expirationDate', '>=', nowISO));
    return onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map((d) => notificationModelFromMap(d.data()));
        callback(notifs);
    });
}

