const { getAllowedResources } = require('./getAllowedResources');

const authenticate = async (req, res, next) => {
    // 1.  (Your existing authentication logic)
    //     * Check for a token, validate it, etc.
    //     * If the user is authenticated, retrieve the user object from your database.
    //     * For this example, I'll just create a dummy user:
    // Replace this with your actual user retrieval
    //req.user = user; // Attach the user to the request
    console.log(req.user)
    try {
        // 2.  Call getAllowedResources to get the allowed resources for the user's role
        const allowedResourcesArray = await getAllowedResources(req.user);

        // 3.  Convert the array to an object
        const allowedResources = {};
        allowedResourcesArray.forEach(resourceScope => {
            const [resource, scope] = resourceScope.split(':');
            allowedResources[resource] = scope;
        });
        console.log({ allowedResources })
        req.allowedResources = allowedResources; // Attach to the request

        next(); // Call next to proceed to the next middleware or route handler
    } catch (error) {
        // Handle errors from getAllowedResources (e.g., database error)
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
        // Or, you might want to redirect to a login page:  res.redirect('/login');
    }
};


const authorize = (resource, scope = 'read') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
        }

        const allowedResources = req.allowedResources;

        if (allowedResources && allowedResources[resource]) {
            // Check if the user has the required scope (e.g., 'read', 'write', 'delete')
            const userScope = allowedResources[resource].split(',').includes(scope); // simplified scope check
            if (userScope) {
                next(); // User is authorized, proceed
            }
            else {
                return res.status(403).json({ error: `Forbidden: Insufficient permissions for resource "${resource}" with scope "${scope}"` });
            }

        } else {
            return res.status(403).json({ error: `Forbidden: Insufficient permissions for resource "${resource}"` });
        }
    };
};

module.exports = {
    authenticate, authorize
}