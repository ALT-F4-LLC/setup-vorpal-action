import * as core from "@actions/core";
import { jest } from "@jest/globals";

export const debug = jest.fn<typeof core.debug>();
export const error = jest.fn<typeof core.error>();
export const getInput = jest.fn<typeof core.getInput>();
export const info = jest.fn<typeof core.info>();
export const setFailed = jest.fn<typeof core.setFailed>();
export const setOutput = jest.fn<typeof core.setOutput>();
export const warning = jest.fn<typeof core.warning>();
export const addPath = jest.fn<typeof core.addPath>();
export const saveState = jest.fn<typeof core.saveState>();
export const getState = jest.fn<typeof core.getState>();
