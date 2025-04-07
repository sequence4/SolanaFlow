"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidBetaCodes = void 0;
const appConfig_1 = require("../config/appConfig");
const getValidBetaCodes = () => {
    if (!appConfig_1.APP_CONFIG.BETA_CODE)
        throw new Error('BETA_CODE is not set in appConfig.ts');
    const codes = appConfig_1.APP_CONFIG.BETA_CODE;
    if (codes)
        console.log("codes", codes);
    return new Set(codes.split(',').map(code => code.trim().toUpperCase()));
};
exports.getValidBetaCodes = getValidBetaCodes;
