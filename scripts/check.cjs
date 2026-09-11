"use strict";
const { project } = require("./project.cjs");
const info = project();
console.log("Project metadata, resolver syntax and changelog validated: " + info.tag);
