const { getAllowedResources } = require('./getAllowedResources');

const authenticate = async (req, res, next) => {

    // 1.  (Your existing authentication logic)
    //     * Check for a token, validate it, etc.
    //     * If the user is authenticated, retrieve the user object from your database.
    //     * For this example, I'll just create a dummy user:
    // Replace this with your actual user retrieval
    //req.user = user; // Attach the user to the request

    try {
        // 2.  Call getAllowedResources to get the allowed resources for the user's role
        const allowedResourcesArray = await getAllowedResources(req.user);

        req.allowedResources = allowedResourcesArray;

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

const authorize = (resource, scope = 'read') => {
    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
        }

        const allowedResources = req.allowedResources;

        // if (allowedResources) {

        //     const permissions = allowedResources?.map((row, i) => {

        //         const r = row.split(':')
        //         console.log(r[0] === resource && r[1] === scope)
        //         if (r[0] === resource && r[1] === scope) {
        //             return next();
        //         }
        //     })
        //     console.log(permissions)
        //     if (permissions.every(value => value === undefined)) {
        //         return res.status(403).json({ error: `Forbidden: Insufficient permissions for resource "${resource}" with scope "${scope}"` });
        //     }
        // } else {
        //     return res.status(403).json({ error: `Forbidden: Insufficient permissions for resource "${resource}" with scope "${scope}"` });
        // }

        if (allowedResources) {
            for (const row of allowedResources) {
                const [resName, resScope] = row.split(':');
                if (resName === resource && resScope === scope) {
                    return next(); // Stop here and move on to the route handler
                }
            }

            // If we looped through all and didn't return:
            return res.status(403).json({
                error: `Forbidden: Insufficient permissions for resource "${resource}" with scope "${scope}"`
            });
        } else {
            return res.status(403).json({
                error: `Forbidden: Insufficient permissions for resource "${resource}" with scope "${scope}"`
            });
        }

    };
};

module.exports = {
    authenticate, authorize
}