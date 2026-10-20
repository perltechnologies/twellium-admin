import { usersApi } from '../api/users';

export const supervisorLabel = (u) =>
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(' ').trim() ||
    u.name ||
    u.username ||
    u.email ||
    `User #${u.id}`;

// Users with the SUPERVISOR role (parsed the same way UserList does).
export const fetchSupervisors = async () => {
    const res = await usersApi.getUsers({ page_size: 200, role: 'SUPERVISOR' });
    const body = res?.data;
    let list = [];
    if (Array.isArray(body)) list = body;
    else if (body?.results) list = body.results;
    else if (body?.data) list = body.data.results || body.data;
    return (Array.isArray(list) ? list : []).filter((u) => String(u.role || '').toUpperCase() === 'SUPERVISOR');
};
