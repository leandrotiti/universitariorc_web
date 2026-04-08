export function notificationModelFromMap(map) {
    return {
        id: map.id || '',
        title: map.title || '',
        body: map.body || '',
        senderId: map.senderId || '',
        senderName: map.senderName || '',
        createdAt: map.createdAt ? new Date(map.createdAt) : new Date(),
        expirationDate: map.expirationDate ? new Date(map.expirationDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetDivisionIds: map.targetDivisionIds || [],
    };
}

export function notificationModelToMap(notif) {
    return {
        id: notif.id,
        title: notif.title,
        body: notif.body,
        senderId: notif.senderId,
        senderName: notif.senderName,
        createdAt: notif.createdAt.toISOString(),
        expirationDate: notif.expirationDate.toISOString(),
        targetDivisionIds: notif.targetDivisionIds,
    };
}
