function errorMiddleware(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
        return res.status(error.status).json({
            success: false,
            message:
                error.type === 'entity.parse.failed' ? 'Invalid JSON' : 'Request body is too large'
        });
    }

    console.error(error);
    return res.status(500).json({
        success: false,
        message: 'An unexpected server error occurred'
    });
}

module.exports = errorMiddleware;
