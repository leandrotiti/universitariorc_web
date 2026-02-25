export function divisionModelFromMap(map) {
    return {
        id: map.id || '',
        name: map.name || '',
        coachIds: map.coachIds || [],
        customAttendanceTypes: map.customAttendanceTypes || [],
        year: map.year || new Date().getFullYear(),
        isHidden: map.isHidden || false,
    };
}

export function divisionModelToMap(division) {
    return {
        id: division.id,
        name: division.name,
        coachIds: division.coachIds,
        customAttendanceTypes: division.customAttendanceTypes,
        year: division.year,
        isHidden: division.isHidden,
    };
}
