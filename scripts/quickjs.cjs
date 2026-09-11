"use strict";
// Optional test engine, installed separately; never bundled in the .fxplug.
const { getQuickJS } = require(process.env.MODEL_HUB_QUICKJS);
async function run(source, ctx, fetch, settings) {
  const engine = await getQuickJS();
  const vm = engine.newContext();
  vm.runtime.setMemoryLimit(32 * 1024 * 1024);
  const deadline = Date.now() + 30000;
  vm.runtime.setInterruptHandler(() => Date.now() > deadline);
  const deferreds = [];
  let promiseHandle;
  try {
    const bridge = vm.newFunction("__fetch", handle => {
      const request = JSON.parse(vm.getString(handle));
      const deferred = vm.newPromise();
      deferreds.push(deferred);
      Promise.resolve().then(() => fetch(request)).then(
        result => {
          const value = vm.newString(JSON.stringify(result));
          deferred.resolve(value);
          value.dispose();
        },
        error => {
          const value = vm.newError(error.message);
          deferred.reject(value);
          value.dispose();
        }
      ).then(() => vm.runtime.executePendingJobs());
      return deferred.handle;
    });
    vm.setProp(vm.global, "__fetch", bridge);
    bridge.dispose();
    vm.unwrapResult(vm.evalCode("globalThis.flux = {settings:" + JSON.stringify(settings) + ",fetch: opts => __fetch(JSON.stringify(opts)).then(JSON.parse)};" + source)).dispose();
    promiseHandle = vm.unwrapResult(vm.evalCode("resolve(" + JSON.stringify(ctx) + ")"));
    const pending = vm.resolvePromise(promiseHandle);
    vm.runtime.executePendingJobs();
    const result = await pending;
    if (result.error) {
      const error = vm.dump(result.error);
      result.error.dispose();
      throw new Error(error.message || String(error));
    }
    const output = vm.dump(result.value);
    result.value.dispose();
    return output;
  } finally {
    if (promiseHandle) promiseHandle.dispose();
    for (const deferred of deferreds) deferred.dispose();
    vm.dispose();
  }
}
module.exports = { run };
