const { Hierarchy } = require('../models');

const normalizeRole = (title) => (title || '').toString().trim().toLowerCase().replace(/\s+/g, '_');

const findNode = (nodes = [], slug) => {
  for (const node of nodes) {
    if (normalizeRole(node.title) === slug) return node;
    const child = findNode(node.children || [], slug);
    if (child) return child;
  }
  return null;
};

const collectDescendants = (node, includeSelf = false) => {
  if (!node) return [];
  const out = [];
  const walk = (n) => {
    out.push(normalizeRole(n.title));
    (n.children || []).forEach(walk);
  };

  if (includeSelf) {
    walk(node);
  } else {
    (node.children || []).forEach(walk);
  }
  return out;
};

const flattenTree = (nodes = [], depth = 0, parentSlug = null, acc = []) => {
  nodes.forEach((n) => {
    const slug = normalizeRole(n.title);
    acc.push({ slug, title: n.title, depth, parentSlug });
    if (n.children && n.children.length) {
      flattenTree(n.children, depth + 1, slug, acc);
    }
  });
  return acc;
};

const buildRoleOptions = (tree = [], fallback = []) => {
  const flattened = flattenTree(tree);
  if (!flattened.length && fallback.length) {
    return fallback.map((role) => ({ value: role, label: role }));
  }
  return flattened.map((node) => ({
    value: node.slug,
    label: `${'— '.repeat(node.depth)}${node.title}`.trim()
  }));
};

const getDescendantRoles = (tree = [], slug, includeSelf = false) => {
  if (!slug) return [];
  const node = findNode(tree, slug);
  if (!node) return [];
  return collectDescendants(node, includeSelf);
};

const getAssignableRolesForUser = (tree = [], userRole, isAdmin = false) => {
  if (isAdmin) return null; // null signals no restriction
  const roles = getDescendantRoles(tree, userRole, true);
  return roles.length ? roles : [normalizeRole(userRole)];
};

const getActiveHierarchyTree = async () => {
  const record = await Hierarchy.findOne({
    where: { is_active: true },
    order: [['updated_at', 'DESC']]
  });

  if (!record || !record.data) return [];
  try {
    return JSON.parse(record.data);
  } catch (e) {
    return [];
  }
};

module.exports = {
  normalizeRole,
  buildRoleOptions,
  getDescendantRoles,
  getAssignableRolesForUser,
  getActiveHierarchyTree
};
