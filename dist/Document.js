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
exports.AnyDocument = exports.Document = void 0;
const aws = require("./aws");
const ddb = require("./aws/ddb/internal");
const utils = require("./utils");
const Error = require("./Error");
const Internal = require("./Internal");
const { internalProperties } = Internal.General;
const dynamooseUndefined = Internal.Public.undefined;
const Populate_1 = require("./Populate");
// Document represents an item in a Model that is either pending (not saved) or saved
class Document {
    constructor(model, object, settings) {
        const documentObject = Document.isDynamoObject(object) ? aws.converter().unmarshall(object) : object;
        Object.keys(documentObject).forEach((key) => this[key] = documentObject[key]);
        Object.defineProperty(this, internalProperties, {
            "configurable": false,
            "value": {}
        });
        this[internalProperties].originalObject = JSON.parse(JSON.stringify(documentObject));
        this[internalProperties].originalSettings = Object.assign({}, settings);
        Object.defineProperty(this, "model", {
            "configurable": false,
            "value": model
        });
        if (settings.type === "fromDynamo") {
            this[internalProperties].storedInDynamo = true;
        }
    }
    static objectToDynamo(object, settings = { "type": "object" }) {
        return (settings.type === "value" ? aws.converter().input : aws.converter().marshall)(object);
    }
    static fromDynamo(object) {
        return aws.converter().unmarshall(object);
    }
    // This function will return null if it's unknown if it is a Dynamo object (ex. empty object). It will return true if it is a Dynamo object and false if it's not.
    static isDynamoObject(object, recurrsive) {
        function isValid(value) {
            if (typeof value === "undefined" || value === null) {
                return false;
            }
            const keys = Object.keys(value);
            const key = keys[0];
            const nestedResult = typeof value[key] === "object" && !(value[key] instanceof Buffer) ? Array.isArray(value[key]) ? value[key].every((value) => Document.isDynamoObject(value, true)) : Document.isDynamoObject(value[key]) : true;
            const { Schema } = require("./Schema");
            const attributeType = Schema.attributeTypes.findDynamoDBType(key);
            return typeof value === "object" && keys.length === 1 && attributeType && (nestedResult || Object.keys(value[key]).length === 0 || attributeType.isSet);
        }
        const keys = Object.keys(object);
        const values = Object.values(object);
        if (keys.length === 0) {
            return null;
        }
        else {
            return recurrsive ? isValid(object) : values.every((value) => isValid(value));
        }
    }
    // This function handles actions that should take place before every response (get, scan, query, batchGet, etc.)
    prepareForResponse() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.model.options.populate) {
                return this.populate({ "properties": this.model.options.populate });
            }
            return this;
        });
    }
    // Original
    original() {
        return this[internalProperties].originalSettings.type === "fromDynamo" ? this[internalProperties].originalObject : null;
        // toJSON
    }
    toJSON() {
        return utils.dynamoose.documentToJSON.bind(this)();
    }
    // Serializer
    serialize(nameOrOptions) {
        return this.model.serializer._serialize(this, nameOrOptions);
    }
    delete(callback) {
        return this.model.delete({
            [this.model.getHashKey()]: this[this.model.getHashKey()]
        }, callback);
    }
    save(settings, callback) {
        if (typeof settings !== "object" && typeof settings !== "undefined") {
            callback = settings;
            settings = {};
        }
        if (typeof settings === "undefined") {
            settings = {};
        }
        const localSettings = settings;
        const paramsPromise = this.toDynamo({ "defaults": true, "validate": true, "required": true, "enum": true, "forceDefault": true, "combine": true, "saveUnknown": true, "customTypesDynamo": true, "updateTimestamps": true, "modifiers": ["set"] }).then((item) => {
            const putItemObj = {
                "Item": item,
                "TableName": this.model.name
            };
            if (localSettings.overwrite === false) {
                putItemObj.ConditionExpression = "attribute_not_exists(#__hash_key)";
                putItemObj.ExpressionAttributeNames = { "#__hash_key": this.model.getHashKey() };
            }
            return putItemObj;
        });
        if (settings.return === "request") {
            if (callback) {
                const localCallback = callback;
                paramsPromise.then((result) => localCallback(null, result));
                return;
            }
            else {
                return paramsPromise;
            }
        }
        const promise = Promise.all([paramsPromise, this.model.pendingTaskPromise()]).then((promises) => {
            const [putItemObj] = promises;
            return ddb("putItem", putItemObj);
        });
        if (callback) {
            const localCallback = callback;
            promise.then(() => {
                this[internalProperties].storedInDynamo = true;
                localCallback(null, this);
            }).catch((error) => callback(error));
        }
        else {
            return (() => __awaiter(this, void 0, void 0, function* () {
                yield promise;
                this[internalProperties].storedInDynamo = true;
                return this;
            }))();
        }
    }
    populate(...args) {
        return Populate_1.PopulateDocument.bind(this)(...args);
    }
}
exports.Document = Document;
class AnyDocument extends Document {
}
exports.AnyDocument = AnyDocument;
// This function will mutate the object passed in to run any actions to conform to the schema that cannot be achieved through non mutating methods in Document.objectFromSchema (setting timestamps, etc.)
Document.prepareForObjectFromSchema = function (object, model, settings) {
    return __awaiter(this, void 0, void 0, function* () {
        if (settings.updateTimestamps) {
            const schema = yield model.schemaForObject(object);
            if (schema.settings.timestamps && settings.type === "toDynamo") {
                const date = new Date();
                const createdAtProperties = (Array.isArray(schema.settings.timestamps.createdAt) ? schema.settings.timestamps.createdAt : [schema.settings.timestamps.createdAt]).filter((a) => Boolean(a));
                const updatedAtProperties = (Array.isArray(schema.settings.timestamps.updatedAt) ? schema.settings.timestamps.updatedAt : [schema.settings.timestamps.updatedAt]).filter((a) => Boolean(a));
                if (object[internalProperties] && !object[internalProperties].storedInDynamo && (typeof settings.updateTimestamps === "boolean" || settings.updateTimestamps.createdAt)) {
                    createdAtProperties.forEach((prop) => {
                        utils.object.set(object, prop, date);
                    });
                }
                if (typeof settings.updateTimestamps === "boolean" || settings.updateTimestamps.updatedAt) {
                    updatedAtProperties.forEach((prop) => {
                        utils.object.set(object, prop, date);
                    });
                }
            }
        }
        return object;
    });
};
// This function will return a list of attributes combining both the schema attributes with the document attributes. This also takes into account all attributes that could exist (ex. properties in sets that don't exist in document), adding the indexes for each item in the document set.
// https://stackoverflow.com/a/59928314/894067
const attributesWithSchemaCache = {};
Document.attributesWithSchema = function (document, model) {
    return __awaiter(this, void 0, void 0, function* () {
        const schema = yield model.schemaForObject(document);
        const attributes = schema.attributes();
        const documentID = utils.object.keys(document).join("");
        if (attributesWithSchemaCache[documentID] && attributesWithSchemaCache[documentID][attributes.join()]) {
            return attributesWithSchemaCache[documentID][attributes.join()];
        }
        // build a tree out of schema attributes
        const root = {};
        attributes.forEach((attribute) => {
            let node = root;
            attribute.split(".").forEach((part) => {
                node[part] = node[part] || {};
                node = node[part];
            });
        });
        // explore the tree
        function traverse(node, treeNode, outPath, callback) {
            callback(outPath);
            if (Object.keys(treeNode).length === 0) { // a leaf
                return;
            }
            Object.keys(treeNode).forEach((attr) => {
                if (attr === "0") {
                    if (!node || node.length == 0) {
                        node = [{}]; // fake the path for arrays
                    }
                    node.forEach((a, index) => {
                        outPath.push(index);
                        traverse(node[index], treeNode[attr], outPath, callback);
                        outPath.pop();
                    });
                }
                else {
                    if (!node) {
                        node = {}; // fake the path for properties
                    }
                    outPath.push(attr);
                    traverse(node[attr], treeNode[attr], outPath, callback);
                    outPath.pop();
                }
            });
        }
        const out = [];
        traverse(document, root, [], (val) => out.push(val.join(".")));
        const result = out.slice(1);
        attributesWithSchemaCache[documentID] = { [attributes.join()]: result };
        return result;
    });
};
// This function will return an object that conforms to the schema (removing any properties that don't exist, using default values, etc.) & throws an error if there is a typemismatch.
Document.objectFromSchema = function (object, model, settings = { "type": "toDynamo" }) {
    return __awaiter(this, void 0, void 0, function* () {
        if (settings.checkExpiredItem && model.options.expires && (model.options.expires.items || {}).returnExpired === false && object[model.options.expires.attribute] && object[model.options.expires.attribute] * 1000 < Date.now()) {
            return undefined;
        }
        const returnObject = Object.assign({}, object);
        const schema = settings.schema || (yield model.schemaForObject(returnObject));
        const schemaAttributes = schema.attributes(returnObject);
        // Type check
        const validParents = []; // This array is used to allow for set contents to not be type checked
        const keysToDelete = [];
        const typeIndexOptionMap = schema.getTypePaths(returnObject, settings);
        const checkTypeFunction = (item) => {
            const [key, value] = item;
            if (validParents.find((parent) => key.startsWith(parent.key) && (parent.infinite || key.split(".").length === parent.key.split(".").length + 1))) {
                return;
            }
            const genericKey = key.replace(/\.\d+/gu, ".0"); // This is a key replacing all list numbers with 0 to standardize things like checking if it exists in the schema
            const existsInSchema = schemaAttributes.includes(genericKey);
            if (existsInSchema) {
                const { isValidType, matchedTypeDetails, typeDetailsArray } = utils.dynamoose.getValueTypeCheckResult(schema, value, genericKey, settings, { "standardKey": true, typeIndexOptionMap });
                if (!isValidType) {
                    throw new Error.TypeMismatch(`Expected ${key} to be of type ${typeDetailsArray.map((detail) => detail.dynamicName ? detail.dynamicName() : detail.name.toLowerCase()).join(", ")}, instead found type ${typeof value}.`);
                }
                else if (matchedTypeDetails.isSet || matchedTypeDetails.name.toLowerCase() === "model") {
                    validParents.push({ key, "infinite": true });
                }
                else if ( /*typeDetails.dynamodbType === "M" || */matchedTypeDetails.dynamodbType === "L") {
                    // The code below is an optimization for large array types to speed up the process of not having to check the type for every element but only the ones that are different
                    value.forEach((subValue, index, array) => {
                        if (index === 0 || typeof subValue !== typeof array[0]) {
                            checkTypeFunction([`${key}.${index}`, subValue]);
                        }
                        else if (keysToDelete.includes(`${key}.0`) && typeof subValue === typeof array[0]) {
                            keysToDelete.push(`${key}.${index}`);
                        }
                    });
                    validParents.push({ key });
                }
            }
            else {
                // Check saveUnknown
                if (!settings.saveUnknown || !utils.dynamoose.wildcard_allowed_check(schema.getSettingValue("saveUnknown"), key)) {
                    keysToDelete.push(key);
                }
            }
        };
        utils.object.entries(returnObject).filter((item) => item[1] !== undefined && item[1] !== dynamooseUndefined).map(checkTypeFunction);
        keysToDelete.reverse().forEach((key) => utils.object.delete(returnObject, key));
        if (settings.defaults || settings.forceDefault) {
            yield Promise.all((yield Document.attributesWithSchema(returnObject, model)).map((key) => __awaiter(this, void 0, void 0, function* () {
                const value = utils.object.get(returnObject, key);
                if (value === dynamooseUndefined) {
                    utils.object.set(returnObject, key, undefined);
                }
                else {
                    const defaultValue = yield schema.defaultCheck(key, value, settings);
                    const isDefaultValueUndefined = Array.isArray(defaultValue) ? defaultValue.some((defaultValue) => typeof defaultValue === "undefined" || defaultValue === null) : typeof defaultValue === "undefined" || defaultValue === null;
                    if (!isDefaultValueUndefined) {
                        const { isValidType, typeDetailsArray } = utils.dynamoose.getValueTypeCheckResult(schema, defaultValue, key, settings, { typeIndexOptionMap });
                        if (!isValidType) {
                            throw new Error.TypeMismatch(`Expected ${key} to be of type ${typeDetailsArray.map((detail) => detail.dynamicName ? detail.dynamicName() : detail.name.toLowerCase()).join(", ")}, instead found type ${typeof defaultValue}.`);
                        }
                        else {
                            utils.object.set(returnObject, key, defaultValue);
                        }
                    }
                }
            })));
        }
        // Custom Types
        if (settings.customTypesDynamo) {
            (yield Document.attributesWithSchema(returnObject, model)).map((key) => {
                const value = utils.object.get(returnObject, key);
                const isValueUndefined = typeof value === "undefined" || value === null;
                if (!isValueUndefined) {
                    const typeDetails = utils.dynamoose.getValueTypeCheckResult(schema, value, key, settings, { typeIndexOptionMap }).matchedTypeDetails;
                    const { customType } = typeDetails;
                    const { "type": typeInfo } = typeDetails.isOfType(value);
                    const isCorrectTypeAlready = typeInfo === (settings.type === "toDynamo" ? "underlying" : "main");
                    if (customType && !isCorrectTypeAlready) {
                        const customValue = customType.functions[settings.type](value);
                        utils.object.set(returnObject, key, customValue);
                    }
                }
            });
        }
        // DynamoDB Type Handler (ex. converting sets to correct value for toDynamo & fromDynamo)
        utils.object.entries(returnObject).filter((item) => typeof item[1] === "object").forEach((item) => {
            const [key, value] = item;
            let typeDetails;
            try {
                typeDetails = utils.dynamoose.getValueTypeCheckResult(schema, value, key, settings, { typeIndexOptionMap }).matchedTypeDetails;
            }
            catch (e) {
                const { Schema } = require("./Schema");
                typeDetails = Schema.attributeTypes.findTypeForValue(value, settings.type, settings);
            }
            if (typeDetails && typeDetails[settings.type]) {
                utils.object.set(returnObject, key, typeDetails[settings.type](value));
            }
        });
        if (settings.combine) {
            schemaAttributes.map((key) => {
                try {
                    const typeDetails = schema.getAttributeTypeDetails(key);
                    return {
                        key,
                        "type": typeDetails
                    };
                }
                catch (e) { } // eslint-disable-line no-empty
            }).map((obj) => {
                if (obj && Array.isArray(obj.type)) {
                    throw new Error.InvalidParameter("Combine type is not allowed to be used with multiple types.");
                }
                return obj;
            }).filter((item) => item.type.name === "Combine").forEach((item) => {
                const { key, type } = item;
                const value = type.typeSettings.attributes.map((attribute) => utils.object.get(returnObject, attribute)).filter((value) => typeof value !== "undefined" && value !== null).join(type.typeSettings.seperator);
                utils.object.set(returnObject, key, value);
            });
        }
        if (settings.modifiers) {
            yield Promise.all(settings.modifiers.map((modifier) => __awaiter(this, void 0, void 0, function* () {
                return Promise.all((yield Document.attributesWithSchema(returnObject, model)).map((key) => __awaiter(this, void 0, void 0, function* () {
                    const value = utils.object.get(returnObject, key);
                    const modifierFunction = yield schema.getAttributeSettingValue(modifier, key, { "returnFunction": true });
                    const modifierFunctionExists = Array.isArray(modifierFunction) ? modifierFunction.some((val) => Boolean(val)) : Boolean(modifierFunction);
                    const isValueUndefined = typeof value === "undefined" || value === null;
                    if (modifierFunctionExists && !isValueUndefined) {
                        const oldValue = object.original ? utils.object.get(object.original(), key) : undefined;
                        utils.object.set(returnObject, key, yield modifierFunction(value, oldValue));
                    }
                })));
            })));
        }
        if (settings.validate) {
            yield Promise.all((yield Document.attributesWithSchema(returnObject, model)).map((key) => __awaiter(this, void 0, void 0, function* () {
                const value = utils.object.get(returnObject, key);
                const isValueUndefined = typeof value === "undefined" || value === null;
                if (!isValueUndefined) {
                    const validator = yield schema.getAttributeSettingValue("validate", key, { "returnFunction": true });
                    if (validator) {
                        let result;
                        if (validator instanceof RegExp) {
                            // TODO: fix the line below to not use `as`. This will cause a weird issue even in vanilla JS, where if your validator is a Regular Expression but the type isn't a string, it will throw a super random error.
                            result = validator.test(value);
                        }
                        else {
                            result = typeof validator === "function" ? yield validator(value) : validator === value;
                        }
                        if (!result) {
                            throw new Error.ValidationError(`${key} with a value of ${value} had a validation error when trying to save the document`);
                        }
                    }
                }
            })));
        }
        if (settings.required) {
            let attributesToCheck = yield Document.attributesWithSchema(returnObject, model);
            if (settings.required === "nested") {
                attributesToCheck = attributesToCheck.filter((attribute) => utils.object.keys(returnObject).find((key) => attribute.startsWith(key)));
            }
            yield Promise.all(attributesToCheck.map((key) => __awaiter(this, void 0, void 0, function* () {
                const check = () => __awaiter(this, void 0, void 0, function* () {
                    const value = utils.object.get(returnObject, key);
                    yield schema.requiredCheck(key, value);
                });
                const keyParts = key.split(".");
                const parentKey = keyParts.slice(0, -1).join(".");
                if (parentKey) {
                    const parentValue = utils.object.get(returnObject, parentKey);
                    const isParentValueUndefined = typeof parentValue === "undefined" || parentValue === null;
                    if (!isParentValueUndefined) {
                        yield check();
                    }
                }
                else {
                    yield check();
                }
            })));
        }
        if (settings.enum) {
            yield Promise.all((yield Document.attributesWithSchema(returnObject, model)).map((key) => __awaiter(this, void 0, void 0, function* () {
                const value = utils.object.get(returnObject, key);
                const isValueUndefined = typeof value === "undefined" || value === null;
                if (!isValueUndefined) {
                    const enumArray = yield schema.getAttributeSettingValue("enum", key);
                    if (enumArray && !enumArray.includes(value)) {
                        throw new Error.ValidationError(`${key} must equal ${JSON.stringify(enumArray)}, but is set to ${value}`);
                    }
                }
            })));
        }
        return returnObject;
    });
};
Document.prototype.toDynamo = function (settings = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const newSettings = Object.assign(Object.assign({}, settings), { "type": "toDynamo" });
        yield Document.prepareForObjectFromSchema(this, this.model, newSettings);
        const object = yield Document.objectFromSchema(this, this.model, newSettings);
        return Document.objectToDynamo(object);
    });
};
// This function will modify the document to conform to the Schema
Document.prototype.conformToSchema = function (settings = { "type": "fromDynamo" }) {
    return __awaiter(this, void 0, void 0, function* () {
        let document = this;
        if (settings.type === "fromDynamo") {
            document = yield this.prepareForResponse();
        }
        yield Document.prepareForObjectFromSchema(document, document.model, settings);
        const expectedObject = yield Document.objectFromSchema(document, document.model, settings);
        if (!expectedObject) {
            return expectedObject;
        }
        const expectedKeys = Object.keys(expectedObject);
        Object.keys(document).forEach((key) => {
            if (!expectedKeys.includes(key)) {
                delete this[key];
            }
            else if (this[key] !== expectedObject[key]) {
                this[key] = expectedObject[key];
            }
        });
        return this;
    });
};
//# sourceMappingURL=Document.js.map