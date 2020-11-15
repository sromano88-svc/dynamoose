"use strict";
module.exports = (object, keys) => {
    (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        const keyParts = (typeof key === "number" ? `${key}` : key).split(".");
        if (keyParts.length === 1) {
            if (Array.isArray(object)) {
                object.splice(parseInt(keyParts[0]), 1);
            }
            else {
                delete object[keyParts[0]];
            }
        }
        else {
            const lastKey = keyParts.pop();
            const nextLastKey = keyParts.pop();
            const nextLastObj = keyParts.reduce((a, key) => a[key], object);
            if (Array.isArray(nextLastObj[nextLastKey])) {
                nextLastObj[nextLastKey].splice(parseInt(lastKey), 1);
            }
            else if (typeof nextLastObj[nextLastKey] !== "undefined" && nextLastObj[nextLastKey] !== null) {
                delete nextLastObj[nextLastKey][lastKey];
            }
        }
    });
    return object;
};
//# sourceMappingURL=delete.js.map