const { execute } = require('../connection-wrapper');

const getAllowedResources = async (user) => {
    try {
        console.log({ user })
        let role;
        if (user.role_id === 100) {
            role = 'sysAdmin';
        } else if (user.role_id === 101) {
            role = 'superior';
        } else {
            role = 'user';
        }

        const sql = 'SELECT resource, scope FROM permissions WHERE role = ?';
        const values = [role];

        const results = await execute(sql, values);
        const resources = results.map(row => `${row.resource}:${row.scope}`);
        return resources;

    } catch (error) {
        console.error('Error fetching allowed resources:', error);
        throw error;
    }
};

module.exports = { getAllowedResources }