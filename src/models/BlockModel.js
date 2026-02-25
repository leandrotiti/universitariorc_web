export function blockModelFromMap(map) {
    return {
        id: map.id || '',
        name: map.name || '',
        divisionIds: map.divisionIds || [],
    };
}

export function blockModelToMap(block) {
    return {
        id: block.id,
        name: block.name,
        divisionIds: block.divisionIds,
    };
}
