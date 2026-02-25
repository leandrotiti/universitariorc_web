export function attendanceModelFromMap(map) {
    return {
        id: map.id || '',
        date: new Date(map.date),
        divisionId: map.divisionId || '',
        type: map.type || 'training',
        presentPlayerIds: map.presentPlayerIds || [],
        absentPlayerIds: map.absentPlayerIds || [],
        latePlayerIds: map.latePlayerIds || [],
        notes: map.notes || null,
    };
}

export function attendanceModelToMap(attendance) {
    return {
        id: attendance.id,
        date: attendance.date.toISOString(),
        divisionId: attendance.divisionId,
        type: attendance.type,
        presentPlayerIds: attendance.presentPlayerIds,
        absentPlayerIds: attendance.absentPlayerIds,
        latePlayerIds: attendance.latePlayerIds,
        notes: attendance.notes,
    };
}
