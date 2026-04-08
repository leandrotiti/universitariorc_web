import { getAllPlayers, getAllUsers, getAllBlocks, getAllDivisions } from '../services/firestoreService';
import { UserRole } from '../models/UserModel';

/**
 * Verifica si un cumpleaños es válido para mostrar: sucedió entre los últimos 7 días y hoy.
 */
export function isBirthdayActive(birthDateStrOrObj) {
    if (!birthDateStrOrObj) return false;
    const bd = new Date(birthDateStrOrObj);
    if (isNaN(bd.getTime())) return false;

    // Fix bug where year is 2000 meaning "unknown"
    if (bd.getFullYear() === 2000) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const birthdayThisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    
    // Si ya pasó el año nuevo y el cumple era en diciembre (ej: hoy 3 de enero, cumple: 30 dic)
    // necesitamos chequear el año pasado tmb
    const birthdayLastYear = new Date(today.getFullYear() - 1, bd.getMonth(), bd.getDate());

    const diffThisYear = Math.floor((today.getTime() - birthdayThisYear.getTime()) / (1000 * 60 * 60 * 24));
    const diffLastYear = Math.floor((today.getTime() - birthdayLastYear.getTime()) / (1000 * 60 * 60 * 24));

    return (diffThisYear >= 0 && diffThisYear <= 7) || (diffLastYear >= 0 && diffLastYear <= 7);
}

export async function checkUserBirthdays(userModel, activeRole) {
    if (!userModel) return [];

    let targetDivisionIds = [];
    const role = activeRole || userModel.roles[0];

    const allDivs = await getAllDivisions();

    // 1. Determinate scope
    if (role === UserRole.admin) {
        targetDivisionIds = 'ALL';
    } else if (role === UserRole.block_admin) {
        if (userModel.assignedBlockId) {
            const allBlocks = await getAllBlocks();
            const myBlock = allBlocks.find(b => b.id === userModel.assignedBlockId);
            if (myBlock) {
                targetDivisionIds = myBlock.divisionIds || [];
            }
        }
    } else if (role === UserRole.coach) {
        // Entrenadores pueden estar en coachIds de las divisiones
        const myDivs = allDivs.filter(d => d.coachIds && d.coachIds.includes(userModel.id));
        targetDivisionIds = [...new Set([...(userModel.assignedDivisionIds || []), ...myDivs.map(d => d.id)])];
    } else if (role === UserRole.manager) {
        targetDivisionIds = userModel.assignedDivisionIds || [];
    } else {
        return [];
    }

    // 2. Fetch People
    const allPlayers = await getAllPlayers();
    const allUsers = await getAllUsers();
    
    let scopePlayers = [];
    let scopeUsers = [];

    if (targetDivisionIds === 'ALL') {
        scopePlayers = allPlayers;
        scopeUsers = allUsers;
    } else {
        scopePlayers = allPlayers.filter(p => targetDivisionIds.includes(p.divisionId));
        scopeUsers = allUsers.filter(u => {
            // Check if user is associated to target divisions (manager / coach)
            const uDivIds = u.assignedDivisionIds || [];
            if (u.assignedDivisionId && !uDivIds.includes(u.assignedDivisionId)) uDivIds.push(u.assignedDivisionId);
            
            const isManagerForTarget = uDivIds.some(id => targetDivisionIds.includes(id));
            const isCoachForTarget = allDivs.some(d => targetDivisionIds.includes(d.id) && d.coachIds?.includes(u.id));
            
            return isManagerForTarget || isCoachForTarget;
        });
    }

    // 3. Filter Birthdays
    const birthdayNotifications = [];

    const addBirthday = (person, type) => {
        if (isBirthdayActive(person.birthDate)) {
            // Create a pseudo-notification
            const isToday = () => {
                const bd = new Date(person.birthDate);
                const today = new Date();
                return bd.getDate() === today.getDate() && bd.getMonth() === today.getMonth();
            };

            const dayText = isToday() ? '¡Hoy' : 'Recientemente';
            
            birthdayNotifications.push({
                id: `bday_${person.id}`,
                title: `${dayText} fue el cumpleaños de ${person.name || person.nickname}! 🎂`,
                body: `Saluda a ${person.name} (${type}) en su día.`,
                senderName: 'Sistema',
                createdAt: new Date(),
                isBirthday: true
            });
        }
    };

    scopePlayers.forEach(p => addBirthday(p, 'Jugador'));
    
    // Avoid re-alerting user for their own birthday? Let's keep it fun and show it anyway, or exclude them:
    scopeUsers.forEach(u => {
        if (u.id !== userModel.id) addBirthday(u, u.roles.includes(UserRole.coach) ? 'Entrenador' : 'Usuario');
    });

    return birthdayNotifications;
}
