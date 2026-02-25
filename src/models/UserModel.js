export const UserRole = {
    admin: 'admin',
    player: 'player',
    coach: 'coach',
    parent: 'parent',
    manager: 'manager',
    block_admin: 'block_admin',
    user: 'user',
};

export const RoleLabels = {
    [UserRole.admin]: 'Admin',
    [UserRole.coach]: 'Entrenador',
    [UserRole.player]: 'Jugador',
    [UserRole.parent]: 'Padre',
    [UserRole.manager]: 'Manager',
    [UserRole.block_admin]: 'Jefe de Bloque',
    [UserRole.user]: 'Usuario',
};

export const RoleDashboardRoutes = {
    [UserRole.admin]: '/admin',
    [UserRole.coach]: '/coach',
    [UserRole.player]: '/player',
    [UserRole.parent]: '/parent',
    [UserRole.manager]: '/manager',
    [UserRole.block_admin]: '/block-admin',
    [UserRole.user]: '/',
};

export function userModelFromMap(map) {
    let roles = [];
    if (map.roles && Array.isArray(map.roles)) {
        roles = map.roles.filter((r) => Object.values(UserRole).includes(r));
        if (roles.length === 0) roles = [UserRole.user];
    } else if (map.role) {
        roles = Object.values(UserRole).includes(map.role) ? [map.role] : [UserRole.user];
    } else {
        roles = [UserRole.user];
    }

    return {
        id: map.id || '',
        email: map.email || '',
        name: map.name || '',
        username: map.username || '',
        dni: map.dni || null,
        phone: map.phone || null,
        roles,
        photoUrl: map.photoUrl || null,
        assignedPlayerIds: map.assignedPlayerIds || [],
        birthDate: map.birthDate ? new Date(map.birthDate) : null,
        assignedDivisionId: map.assignedDivisionId || null,
        mustChangePassword: map.mustChangePassword || false,
        avatarId: map.avatarId || null,
        assignedBlockId: map.assignedBlockId || null,
        keywords: map.keywords || [],
    };
}

export function userModelToMap(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        dni: user.dni,
        phone: user.phone,
        roles: user.roles,
        photoUrl: user.photoUrl,
        assignedPlayerIds: user.assignedPlayerIds,
        birthDate: user.birthDate ? user.birthDate.toISOString() : null,
        assignedDivisionId: user.assignedDivisionId,
        mustChangePassword: user.mustChangePassword,
        avatarId: user.avatarId,
        assignedBlockId: user.assignedBlockId,
        keywords: user.keywords,
    };
}

export function getPrimaryRole(user) {
    return user.roles && user.roles.length > 0 ? user.roles[0] : UserRole.user;
}

export function getRoleLabel(user) {
    return user.roles.map((r) => RoleLabels[r] || '').join(', ');
}
