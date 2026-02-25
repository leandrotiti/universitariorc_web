export function playerModelFromMap(map) {
    let birthDate;
    try {
        birthDate = new Date(map.birthDate);
        if (isNaN(birthDate.getTime())) birthDate = new Date(2000, 0, 1);
    } catch {
        birthDate = new Date(2000, 0, 1);
    }

    // Migration: If 'hasPaidPlayerRights' exists and is true, add current year
    let paidPlayerRightsYears = [];
    if (map.paidPlayerRightsYears) {
        paidPlayerRightsYears = [...map.paidPlayerRightsYears];
    } else if (map.hasPaidPlayerRights === true) {
        paidPlayerRightsYears = [new Date().getFullYear()];
    }

    return {
        id: map.id || '',
        name: map.name || '',
        dni: map.dni || '',
        birthDate,
        phone: map.phone || '',
        divisionId: map.divisionId || '',
        photoUrl: map.photoUrl || null,
        email: map.email || '',
        userId: map.userId || null,
        clubFeePayments: map.clubFeePayments || {},
        paidPlayerRightsYears,
    };
}

export function playerModelToMap(player) {
    return {
        id: player.id,
        name: player.name,
        dni: player.dni,
        birthDate: player.birthDate.toISOString(),
        phone: player.phone,
        divisionId: player.divisionId,
        photoUrl: player.photoUrl,
        email: player.email,
        userId: player.userId,
        clubFeePayments: player.clubFeePayments,
        paidPlayerRightsYears: player.paidPlayerRightsYears,
    };
}
