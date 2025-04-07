"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeProjectName = void 0;
const normalizeProjectName = (name) => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};
exports.normalizeProjectName = normalizeProjectName;
