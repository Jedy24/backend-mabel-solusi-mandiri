async function recordAudit(db, actor, action, targetType, targetId, changes) {
    return db.auditLog.create({
        data: {
            actorId: actor.id,
            actorEmail: actor.email,
            actorRole: actor.role,
            action,
            targetType,
            targetId,
            changes: changes === undefined ? null : JSON.stringify(changes)
        }
    });
}

module.exports = { recordAudit };