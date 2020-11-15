"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Schema = void 0;
const CustomError = require("./Error");
const utils = require("./utils");
const Internal = require("./Internal");
const Document_1 = require("./Document");
class DynamoDBType {
    constructor(obj) {
        Object.keys(obj).forEach((key) => {
            this[key] = obj[key];
        });
    }
    result(typeSettings) {
        // Can't use variable below to check type, see TypeScript issue link below for more information
        // https://github.com/microsoft/TypeScript/issues/37855
        // const isSubType = this.dynamodbType instanceof DynamoDBType; // Represents underlying DynamoDB type for custom types
        const type = this.dynamodbType instanceof DynamoDBType ? this.dynamodbType : this;
        const dynamodbType = (() => {
            if (this.dynamodbType instanceof DynamoDBType) {
                return this.dynamodbType.dynamodbType;
            }
            else if (typeof this.dynamodbType === "function") {
                return this.dynamodbType(typeSettings);
            }
            else {
                return this.dynamodbType;
            }
        })();
        const result = {
            "name": this.name,
            dynamodbType,
            "nestedType": this.nestedType,
            "isOfType": this.jsType.func ? this.jsType.func : (val) => {
                return [{ "value": this.jsType, "type": "main" }, { "value": this.dynamodbType instanceof DynamoDBType ? type.jsType : null, "type": "underlying" }].filter((a) => Boolean(a.value)).find((jsType) => typeof jsType.value === "string" ? typeof val === jsType.value : val instanceof jsType.value);
            },
            "isSet": false,
            typeSettings
        };
        if (this.dynamicName) {
            result.dynamicName = () => this.dynamicName(typeSettings);
        }
        if (this.customType) {
            const functions = this.customType.functions(typeSettings);
            result.customType = Object.assign(Object.assign({}, this.customType), { functions });
        }
        const isSetAllowed = typeof type.set === "function" ? type.set(typeSettings) : type.set;
        if (isSetAllowed) {
            let typeName;
            if (type.customDynamoName) {
                typeName = typeof type.customDynamoName === "function" ? type.customDynamoName(typeSettings) : type.customDynamoName;
            }
            else {
                typeName = type.name;
            }
            result.set = {
                "name": `${this.name} Set`,
                "isSet": true,
                "dynamodbType": `${dynamodbType}S`,
                "isOfType": (val, type, settings = {}) => {
                    if (type === "toDynamo") {
                        return !settings.saveUnknown && Array.isArray(val) && val.every((subValue) => result.isOfType(subValue)) || val instanceof Set && [...val].every((subValue) => result.isOfType(subValue));
                    }
                    else {
                        const setVal = val; // TODO: Probably bad practice here, should figure out how to do this better.
                        return setVal.wrapperName === "Set" && setVal.type === typeName && Array.isArray(setVal.values);
                    }
                },
                "toDynamo": (val) => ({ "wrapperName": "Set", "type": typeName, "values": [...val] }),
                "fromDynamo": (val) => new Set(val.values),
                typeSettings
            };
            if (this.dynamicName) {
                result.set.dynamicName = () => `${this.dynamicName(typeSettings)} Set`;
            }
            if (this.customType) {
                result.set.customType = {
                    "functions": {
                        "toDynamo": (val) => val.map(result.customType.functions.toDynamo),
                        "fromDynamo": (val) => (Object.assign(Object.assign({}, val), { "values": val.values.map(result.customType.functions.fromDynamo) })),
                        "isOfType": (val, type) => {
                            if (type === "toDynamo") {
                                return Array.isArray(val) && val.every((item) => result.customType.functions.isOfType(item, type));
                            }
                            else {
                                const setVal = val; // TODO: Probably bad practice here, should figure out how to do this better.
                                return setVal.wrapperName === "Set" && setVal.type === typeName && Array.isArray(setVal.values);
                            }
                        }
                    }
                };
            }
        }
        return result;
    }
}
const attributeTypesMain = (() => {
    const numberType = new DynamoDBType({ "name": "Number", "dynamodbType": "N", "set": true, "jsType": "number" });
    const stringType = new DynamoDBType({ "name": "String", "dynamodbType": "S", "set": true, "jsType": "string" });
    return [
        new DynamoDBType({ "name": "Buffer", "dynamodbType": "B", "set": true, "jsType": Buffer, "customDynamoName": "Binary" }),
        new DynamoDBType({ "name": "Boolean", "dynamodbType": "BOOL", "jsType": "boolean" }),
        new DynamoDBType({ "name": "Array", "dynamodbType": "L", "jsType": { "func": Array.isArray }, "nestedType": true }),
        new DynamoDBType({ "name": "Object", "dynamodbType": "M", "jsType": { "func": (val) => Boolean(val) && val.constructor === Object && (val.wrapperName !== "Set" || Object.keys(val).length !== 3 || !val.type || !val.values) }, "nestedType": true }),
        numberType,
        stringType,
        new DynamoDBType({ "name": "Date", "dynamodbType": numberType, "customType": {
                "functions": (typeSettings) => ({
                    "toDynamo": (val) => {
                        if (typeSettings.storage === "seconds") {
                            return Math.round(val.getTime() / 1000);
                        }
                        else {
                            return val.getTime();
                        }
                    },
                    "fromDynamo": (val) => {
                        if (typeSettings.storage === "seconds") {
                            return new Date(val * 1000);
                        }
                        else {
                            return new Date(val);
                        }
                    },
                    "isOfType": (val, type) => {
                        return type === "toDynamo" ? val instanceof Date : typeof val === "number";
                    }
                })
            }, "jsType": Date }),
        new DynamoDBType({ "name": "Combine", "dynamodbType": stringType, "set": false, "jsType": String }),
        new DynamoDBType({ "name": "Model", "customDynamoName": (typeSettings) => {
                const model = typeSettings.model.Model;
                const hashKey = model.getHashKey();
                const typeDetails = model.schemas[0].getAttributeTypeDetails(hashKey); // This has no potiental of being an array because a hashKey is not allowed to have multiple type options
                return typeDetails.name;
            }, "dynamicName": (typeSettings) => typeSettings.model.Model.name, "dynamodbType": (typeSettings) => {
                const model = typeSettings.model.Model;
                const hashKey = model.getHashKey();
                const rangeKey = model.getRangeKey();
                return rangeKey ? "M" : model.schemas[0].getAttributeType(hashKey);
            }, "set": (typeSettings) => {
                return !typeSettings.model.Model.getRangeKey();
            }, "jsType": { "func": (val) => val.prototype instanceof Document_1.Document }, "customType": {
                "functions": (typeSettings) => ({
                    "toDynamo": (val) => {
                        var _a;
                        const model = typeSettings.model.Model;
                        const hashKey = model.getHashKey();
                        const rangeKey = model.getRangeKey();
                        if (rangeKey) {
                            return {
                                [hashKey]: val[hashKey],
                                [rangeKey]: val[rangeKey]
                            };
                        }
                        else {
                            return (_a = val[hashKey]) !== null && _a !== void 0 ? _a : val;
                        }
                    },
                    "fromDynamo": (val) => val,
                    "isOfType": (val, type) => {
                        var _a;
                        const model = typeSettings.model.Model;
                        const hashKey = model.getHashKey();
                        const rangeKey = model.getRangeKey();
                        if (rangeKey) {
                            return typeof val === "object" && val[hashKey] && val[rangeKey];
                        }
                        else {
                            return utils.dynamoose.getValueTypeCheckResult(model.schemas[0], (_a = val[hashKey]) !== null && _a !== void 0 ? _a : val, hashKey, { type }, {}).isValidType;
                        }
                    }
                })
            } })
    ];
})();
const attributeTypes = utils.array_flatten(attributeTypesMain.filter((checkType) => !checkType.customType).map((checkType) => checkType.result()).map((a) => [a, a.set])).filter((a) => Boolean(a));
class Schema {
    constructor(object, settings = {}) {
        if (!object || typeof object !== "object" || Array.isArray(object)) {
            throw new CustomError.InvalidParameterType("Schema initalization parameter must be an object.");
        }
        if (Object.keys(object).length === 0) {
            throw new CustomError.InvalidParameter("Schema initalization parameter must not be an empty object.");
        }
        if (settings.timestamps === true) {
            settings.timestamps = {
                "createdAt": "createdAt",
                "updatedAt": "updatedAt"
            };
        }
        if (settings.timestamps) {
            const createdAtArray = Array.isArray(settings.timestamps.createdAt) ? settings.timestamps.createdAt : [settings.timestamps.createdAt];
            const updatedAtArray = Array.isArray(settings.timestamps.updatedAt) ? settings.timestamps.updatedAt : [settings.timestamps.updatedAt];
            [...createdAtArray, ...updatedAtArray].forEach((prop) => {
                if (object[prop]) {
                    throw new CustomError.InvalidParameter("Timestamp attributes must not be defined in schema.");
                }
                object[prop] = Date;
            });
        }
        let parsedSettings = Object.assign({}, settings);
        const parsedObject = Object.assign({}, object);
        utils.object.entries(parsedObject).filter((entry) => entry[1] instanceof Schema).forEach((entry) => {
            const [key, value] = entry;
            let newValue = {
                "type": Object,
                "schema": value.schemaObject
            };
            if (key.endsWith(".schema")) {
                newValue = value.schemaObject;
            }
            const subSettings = Object.assign({}, value.settings);
            Object.entries(subSettings).forEach((entry) => {
                const [settingsKey, settingsValue] = entry;
                switch (settingsKey) {
                    case "saveUnknown":
                        subSettings[settingsKey] = typeof subSettings[settingsKey] === "boolean" ? [`${key}.**`] : settingsValue.map((val) => `${key}.${val}`);
                        break;
                    case "timestamps":
                        subSettings[settingsKey] = Object.entries(subSettings[settingsKey]).reduce((obj, entity) => {
                            const [subKey, subValue] = entity;
                            obj[subKey] = Array.isArray(subValue) ? subValue.map((subValue) => `${key}.${subValue}`) : `${key}.${subValue}`;
                            return obj;
                        }, {});
                        break;
                }
            });
            parsedSettings = utils.merge_objects.main({ "combineMethod": "array_merge_new_arrray" })(parsedSettings, subSettings);
            utils.object.set(parsedObject, key, newValue);
        });
        // Anytime `this.schemaObject` is modified, `this[internalCache].attributes` must be set to undefined or null
        this.schemaObject = parsedObject;
        this.settings = parsedSettings;
        const checkAttributeNameDots = (object /*, existingKey = ""*/) => {
            Object.keys(object).forEach((key) => {
                if (key.includes(".")) {
                    throw new CustomError.InvalidParameter("Attributes must not contain dots.");
                }
                // TODO: lots of `as` statements in the two lines below. We should clean that up.
                if (typeof object[key] === "object" && object[key] !== null && object[key].schema) {
                    checkAttributeNameDots(object[key].schema /*, key*/);
                }
            });
        };
        checkAttributeNameDots(this.schemaObject);
        const checkMultipleArraySchemaElements = (key) => {
            let attributeType = [];
            try {
                const tmpAttributeType = this.getAttributeType(key);
                attributeType = Array.isArray(tmpAttributeType) ? tmpAttributeType : [tmpAttributeType];
            }
            catch (e) { } // eslint-disable-line no-empty
            if (attributeType.some((type) => type === "L") && (this.getAttributeValue(key).schema || []).length > 1) {
                throw new CustomError.InvalidParameter("You must only pass one element into schema array.");
            }
        };
        this.attributes().forEach((key) => checkMultipleArraySchemaElements(key));
        const hashrangeKeys = this.attributes().reduce((val, key) => {
            const hashKey = this.getAttributeSettingValue("hashKey", key);
            const rangeKey = this.getAttributeSettingValue("rangeKey", key);
            const isHashKey = Array.isArray(hashKey) ? hashKey.every((item) => Boolean(item)) : hashKey;
            const isRangeKey = Array.isArray(rangeKey) ? rangeKey.every((item) => Boolean(item)) : rangeKey;
            if (isHashKey) {
                val.hashKeys.push(key);
            }
            if (isRangeKey) {
                val.rangeKeys.push(key);
            }
            if (isHashKey && isRangeKey) {
                val.hashAndRangeKeyAttributes.push(key);
            }
            return val;
        }, { "hashKeys": [], "rangeKeys": [], "hashAndRangeKeyAttributes": [] });
        const keyTypes = ["hashKey", "rangeKey"];
        keyTypes.forEach((keyType) => {
            if (hashrangeKeys[`${keyType}s`].length > 1) {
                throw new CustomError.InvalidParameter(`Only one ${keyType} allowed per schema.`);
            }
            if (hashrangeKeys[`${keyType}s`].find((key) => key.includes("."))) {
                throw new CustomError.InvalidParameter(`${keyType} must be at root object and not nested in object or array.`);
            }
        });
        if (hashrangeKeys.hashAndRangeKeyAttributes.length > 0) {
            throw new CustomError.InvalidParameter(`Attribute ${hashrangeKeys.hashAndRangeKeyAttributes[0]} must not be both hashKey and rangeKey`);
        }
        this.attributes().forEach((key) => {
            if (key.includes(".") && this.getAttributeSettingValue("index", key)) {
                throw new CustomError.InvalidParameter("Index must be at root object and not nested in object or array.");
            }
        });
    }
    getCreateTableAttributeParams(model) {
        return __awaiter(this, void 0, void 0, function* () {
            const hashKey = this.getHashKey();
            const AttributeDefinitions = [
                {
                    "AttributeName": hashKey,
                    "AttributeType": this.getSingleAttributeType(hashKey)
                }
            ];
            const AttributeDefinitionsNames = [hashKey];
            const KeySchema = [
                {
                    "AttributeName": hashKey,
                    "KeyType": "HASH"
                }
            ];
            const rangeKey = this.getRangeKey();
            if (rangeKey) {
                AttributeDefinitions.push({
                    "AttributeName": rangeKey,
                    "AttributeType": this.getSingleAttributeType(rangeKey)
                });
                AttributeDefinitionsNames.push(rangeKey);
                KeySchema.push({
                    "AttributeName": rangeKey,
                    "KeyType": "RANGE"
                });
            }
            utils.array_flatten(yield Promise.all([this.getIndexAttributes(), this.getIndexRangeKeyAttributes()])).map((obj) => obj.attribute).forEach((index) => {
                if (AttributeDefinitionsNames.includes(index)) {
                    return;
                }
                AttributeDefinitionsNames.push(index);
                AttributeDefinitions.push({
                    "AttributeName": index,
                    "AttributeType": this.getSingleAttributeType(index)
                });
            });
            return Object.assign({ AttributeDefinitions,
                KeySchema }, yield this.getIndexes(model));
        });
    }
    // This function has the same behavior as `getAttributeType` except if the schema has multiple types, it will throw an error. This is useful for attribute definitions and keys for when you are only allowed to have one type for an attribute
    getSingleAttributeType(key, value, settings) {
        const attributeType = this.getAttributeType(key, value, settings);
        if (Array.isArray(attributeType)) {
            throw new CustomError.InvalidParameter(`You can not have multiple types for attribute definition: ${key}.`);
        }
        return attributeType;
    }
    getAttributeType(key, value, settings) {
        try {
            const typeDetails = this.getAttributeTypeDetails(key);
            return Array.isArray(typeDetails) ? typeDetails.map((detail) => detail.dynamodbType) : typeDetails.dynamodbType;
        }
        catch (e) {
            if ((settings === null || settings === void 0 ? void 0 : settings.unknownAttributeAllowed) && e.message === `Invalid Attribute: ${key}` && value) {
                return Object.keys(Document_1.Document.objectToDynamo(value, { "type": "value" }))[0];
            }
            else {
                throw e;
            }
        }
    }
    // This function will take in an attribute and value, and returns the default value if it should be applied.
    defaultCheck(key, value, settings) {
        return __awaiter(this, void 0, void 0, function* () {
            const isValueUndefined = typeof value === "undefined" || value === null;
            if (settings.defaults && isValueUndefined || settings.forceDefault && (yield this.getAttributeSettingValue("forceDefault", key))) {
                const defaultValue = yield this.getAttributeSettingValue("default", key);
                const isDefaultValueUndefined = typeof defaultValue === "undefined" || defaultValue === null;
                if (!isDefaultValueUndefined) {
                    return defaultValue;
                }
            }
        });
    }
    getAttributeSettingValue(setting, key, settings = { "returnFunction": false }) {
        function func(attributeValue) {
            const defaultPropertyValue = (attributeValue || {})[setting];
            return typeof defaultPropertyValue === "function" && !settings.returnFunction ? defaultPropertyValue() : defaultPropertyValue;
        }
        const attributeValue = this.getAttributeValue(key);
        if (Array.isArray(attributeValue)) {
            return attributeValue.map(func);
        }
        else {
            return func(attributeValue);
        }
    }
    getTypePaths(object, settings = { "type": "toDynamo" }) {
        return Object.entries(object).reduce((result, entry) => {
            const [key, value] = entry;
            const fullKey = [settings.previousKey, key].filter((a) => Boolean(a)).join(".");
            let typeCheckResult;
            try {
                typeCheckResult = utils.dynamoose.getValueTypeCheckResult(this, value, fullKey, settings, {});
            }
            catch (e) {
                if (result && settings.includeAllProperties) {
                    result[fullKey] = {
                        "index": 0,
                        "matchCorrectness": 0,
                        "entryCorrectness": [0]
                    };
                }
                return result;
            }
            const { typeDetails, matchedTypeDetailsIndex, matchedTypeDetailsIndexes } = typeCheckResult;
            const hasMultipleTypes = Array.isArray(typeDetails);
            const isObject = typeof value === "object";
            if (hasMultipleTypes) {
                if (matchedTypeDetailsIndexes.length > 1 && isObject) {
                    result[fullKey] = matchedTypeDetailsIndexes.map((index) => {
                        const entryCorrectness = utils.object.entries(value).map((entry) => {
                            const [subKey, subValue] = entry;
                            try {
                                const { isValidType } = utils.dynamoose.getValueTypeCheckResult(this, subValue, `${fullKey}.${subKey}`, settings, { "typeIndexOptionMap": { [key]: index } }); // TODO add {typeMap: {[key]: index}}
                                return isValidType ? 1 : 0;
                            }
                            catch (e) {
                                return 0.5;
                            }
                        });
                        return {
                            index,
                            // 1 = full match
                            // 0.5 = attributes don't exist
                            // 0 = types don't match
                            "matchCorrectness": Math.min(...entryCorrectness),
                            entryCorrectness
                        };
                    }).sort((a, b) => {
                        if (a.matchCorrectness === b.matchCorrectness) {
                            return b.entryCorrectness.reduce((a, b) => a + b, 0) - a.entryCorrectness.reduce((a, b) => a + b, 0);
                        }
                        else {
                            return b.matchCorrectness - a.matchCorrectness;
                        }
                    }).map((a) => a.index)[0];
                }
                if (result[fullKey] === undefined) {
                    result[fullKey] = matchedTypeDetailsIndex;
                }
            }
            else if (settings.includeAllProperties) {
                let matchCorrectness;
                try {
                    const { isValidType } = utils.dynamoose.getValueTypeCheckResult(this, value, key, settings, {}); // TODO add {typeMap: {[key]: index}}
                    matchCorrectness = isValidType ? 1 : 0;
                }
                catch (e) {
                    matchCorrectness = 0.5;
                }
                result[fullKey] = {
                    "index": 0,
                    matchCorrectness,
                    "entryCorrectness": [matchCorrectness]
                };
            }
            if (isObject) {
                result = Object.assign(Object.assign({}, result), this.getTypePaths(value, Object.assign(Object.assign({}, settings), { "previousKey": fullKey })));
            }
            return result;
        }, {});
    }
}
exports.Schema = Schema;
Schema.attributeTypes = {
    "findDynamoDBType": (type) => attributeTypes.find((checkType) => checkType.dynamodbType === type),
    "findTypeForValue": (...args) => attributeTypes.find((checkType) => checkType.isOfType(...args))
};
// TODO: in the two functions below I don't think we should be using as. We should try to clean that up.
Schema.prototype.getHashKey = function () {
    return Object.keys(this.schemaObject).find((key) => this.schemaObject[key].hashKey) || Object.keys(this.schemaObject)[0];
};
Schema.prototype.getRangeKey = function () {
    return Object.keys(this.schemaObject).find((key) => this.schemaObject[key].rangeKey);
};
// This function will take in an attribute and value, and throw an error if the property is required and the value is undefined or null.
Schema.prototype.requiredCheck = function (key, value) {
    return __awaiter(this, void 0, void 0, function* () {
        const isRequired = yield this.getAttributeSettingValue("required", key);
        if ((typeof value === "undefined" || value === null) && isRequired) {
            throw new CustomError.ValidationError(`${key} is a required property but has no value when trying to save document`);
        }
    });
};
Schema.prototype.getIndexAttributes = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield Promise.all(this.attributes().map((attribute) => __awaiter(this, void 0, void 0, function* () { return ({ "index": yield this.getAttributeSettingValue("index", attribute), attribute }); })))).filter((obj) => obj.index);
    });
};
Schema.prototype.getIndexRangeKeyAttributes = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const indexes = yield this.getIndexAttributes();
        return indexes.map((index) => index.index.rangeKey).filter((a) => Boolean(a)).map((a) => ({ "attribute": a }));
    });
};
Schema.prototype.getIndexes = function (model) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield this.getIndexAttributes()).reduce((accumulator, currentValue) => {
            const indexValue = currentValue.index;
            const attributeValue = currentValue.attribute;
            const dynamoIndexObject = {
                "IndexName": indexValue.name || `${attributeValue}${indexValue.global ? "GlobalIndex" : "LocalIndex"}`,
                "KeySchema": [],
                "Projection": { "ProjectionType": "KEYS_ONLY" }
            };
            if (indexValue.project || typeof indexValue.project === "undefined" || indexValue.project === null) {
                dynamoIndexObject.Projection = Array.isArray(indexValue.project) ? { "ProjectionType": "INCLUDE", "NonKeyAttributes": indexValue.project } : { "ProjectionType": "ALL" };
            }
            if (indexValue.global) {
                dynamoIndexObject.KeySchema.push({ "AttributeName": attributeValue, "KeyType": "HASH" });
                if (indexValue.rangeKey) {
                    dynamoIndexObject.KeySchema.push({ "AttributeName": indexValue.rangeKey, "KeyType": "RANGE" });
                }
                const throughputObject = utils.dynamoose.get_provisioned_throughput(indexValue.throughput ? indexValue : model.options.throughput === "ON_DEMAND" ? {} : model.options);
                // TODO: fix up the two lines below. Using too many `as` statements.
                if (throughputObject.ProvisionedThroughput) {
                    dynamoIndexObject.ProvisionedThroughput = throughputObject.ProvisionedThroughput;
                }
            }
            else {
                dynamoIndexObject.KeySchema.push({ "AttributeName": this.getHashKey(), "KeyType": "HASH" });
                dynamoIndexObject.KeySchema.push({ "AttributeName": attributeValue, "KeyType": "RANGE" });
            }
            const accumulatorKey = indexValue.global ? "GlobalSecondaryIndexes" : "LocalSecondaryIndexes";
            if (!accumulator[accumulatorKey]) {
                accumulator[accumulatorKey] = [];
            }
            accumulator[accumulatorKey].push(dynamoIndexObject);
            return accumulator;
        }, {});
    });
};
Schema.prototype.getSettingValue = function (setting) {
    return this.settings[setting];
};
function attributesAction(object) {
    const typePaths = object && this.getTypePaths(object);
    const main = (object, existingKey = "") => {
        return Object.keys(object).reduce((accumulator, key) => {
            const keyWithExisting = `${existingKey ? `${existingKey}.` : ""}${key}`;
            accumulator.push(keyWithExisting);
            let attributeType;
            try {
                const tmpAttributeType = this.getAttributeType(keyWithExisting);
                attributeType = Array.isArray(tmpAttributeType) ? tmpAttributeType : [tmpAttributeType];
            }
            catch (e) { } // eslint-disable-line no-empty
            // TODO: using too many `as` statements in the few lines below. Clean that up.
            function recursive(type, arrayTypeIndex) {
                if ((type === "M" || type === "L") && (object[key][arrayTypeIndex] || object[key]).schema) {
                    accumulator.push(...main((object[key][arrayTypeIndex] || object[key]).schema, keyWithExisting));
                }
            }
            if (attributeType) {
                if (typePaths && typePaths[keyWithExisting] !== undefined) {
                    const index = typePaths[keyWithExisting];
                    const type = attributeType[index];
                    recursive(type, index);
                }
                else {
                    attributeType.forEach(recursive);
                }
            }
            // ------------------------------
            return accumulator;
        }, []);
    };
    return main(this.schemaObject);
}
Schema.prototype.attributes = function (object) {
    return attributesAction.call(this, object);
};
Schema.prototype.getAttributeValue = function (key, settings) {
    const previousKeyParts = [];
    return ((settings === null || settings === void 0 ? void 0 : settings.standardKey) ? key : key.replace(/\.\d+/gu, ".0")).split(".").reduce((result, part) => {
        if (Array.isArray(result)) {
            const predefinedIndex = settings && settings.typeIndexOptionMap && settings.typeIndexOptionMap[previousKeyParts.join(".")];
            if (predefinedIndex !== undefined) {
                result = result[predefinedIndex];
            }
            else {
                result = result.find((item) => item.schema && item.schema[part]);
            }
        }
        previousKeyParts.push(part);
        return utils.object.get(result.schema, part);
    }, { "schema": this.schemaObject });
};
function retrieveTypeInfo(type, isSet, key, typeSettings) {
    const foundType = attributeTypesMain.find((checkType) => checkType.name.toLowerCase() === type.toLowerCase());
    if (!foundType) {
        throw new CustomError.InvalidType(`${key} contains an invalid type: ${type}`);
    }
    const parentType = foundType.result(typeSettings);
    if (!parentType.set && isSet) {
        throw new CustomError.InvalidType(`${key} with type: ${type} is not allowed to be a set`);
    }
    return isSet ? parentType.set : parentType;
}
// TODO: using too many `as` statements in the function below. We should clean this up.
Schema.prototype.getAttributeTypeDetails = function (key, settings = {}) {
    const standardKey = settings.standardKey ? key : key.replace(/\.\d+/gu, ".0");
    const val = this.getAttributeValue(standardKey, Object.assign(Object.assign({}, settings), { "standardKey": true }));
    if (!val) {
        throw new CustomError.UnknownAttribute(`Invalid Attribute: ${key}`);
    }
    let typeVal = typeof val === "object" && !Array.isArray(val) ? val.type : val;
    let typeSettings = {};
    if (typeof typeVal === "object" && !Array.isArray(typeVal)) {
        typeSettings = typeVal.settings || {};
        typeVal = typeVal.value;
    }
    const getType = (typeVal) => {
        let type;
        const isThisType = typeVal === Internal.Public.this;
        if (typeof typeVal === "function" || isThisType) {
            if (typeVal.prototype instanceof Document_1.Document || isThisType) {
                type = "model";
                if (isThisType) {
                    typeSettings.model = {
                        "Model": {
                            "getHashKey": this.getHashKey.bind(this),
                            "getRangeKey": this.getRangeKey.bind(this),
                            "schemas": [this]
                        }
                    };
                }
                else {
                    typeSettings.model = typeVal;
                }
            }
            else {
                const regexFuncName = /^Function ([^(]+)\(/iu;
                [, type] = typeVal.toString().match(regexFuncName);
            }
        }
        else {
            type = typeVal;
        }
        return type;
    };
    const result = (Array.isArray(typeVal) ? typeVal : [typeVal]).map((item, index) => {
        item = typeof item === "object" && !Array.isArray(item) && item.type ? item.type : item;
        if (typeof item === "object" && !Array.isArray(item)) {
            typeSettings = item.settings || {};
            item = item.value;
        }
        let type = getType(item);
        const isSet = type.toLowerCase() === "set";
        if (isSet) {
            let schemaValue = this.getAttributeSettingValue("schema", key);
            if (Array.isArray(schemaValue[index])) {
                schemaValue = schemaValue[index];
            }
            type = getType(schemaValue[0]);
        }
        const returnObject = retrieveTypeInfo(type, isSet, key, typeSettings);
        return returnObject;
    });
    const returnObject = result.length < 2 ? result[0] : result;
    return returnObject;
};
//# sourceMappingURL=Schema.js.map