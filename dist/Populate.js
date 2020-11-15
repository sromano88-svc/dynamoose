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
exports.PopulateDocuments = exports.PopulateDocument = void 0;
const utils = require("./utils");
function PopulateDocument(settings, callback, internalSettings) {
    if (typeof settings === "function") {
        callback = settings;
        settings = {};
    }
    if (!internalSettings) {
        internalSettings = {};
    }
    const { model } = this;
    const localSettings = settings;
    const promise = model.schemaForObject(this).then((schema) => {
        const modelAttributes = utils.array_flatten(schema.attributes().map((prop) => ({ prop, "details": schema.getAttributeTypeDetails(prop) }))).filter((obj) => Array.isArray(obj.details) ? obj.details.some((detail) => detail.name === "Model") : obj.details.name === "Model").map((obj) => obj.prop);
        return { schema, modelAttributes };
    }).then((obj) => {
        const { schema, modelAttributes } = obj;
        return Promise.all(modelAttributes.map((prop) => __awaiter(this, void 0, void 0, function* () {
            const typeDetails = schema.getAttributeTypeDetails(prop);
            const typeDetail = Array.isArray(typeDetails) ? typeDetails.find((detail) => detail.name === "Model") : typeDetails;
            const { typeSettings } = typeDetail;
            // TODO: `subModel` is currently any, we should fix that
            const subModel = typeof typeSettings.model === "object" ? model.Document : typeSettings.model;
            const doesPopulatePropertyExist = !(typeof this[prop] === "undefined" || this[prop] === null);
            if (!doesPopulatePropertyExist || this[prop] instanceof subModel) {
                return;
            }
            const key = [internalSettings.parentKey, prop].filter((a) => Boolean(a)).join(".");
            const populatePropertiesExists = typeof (localSettings === null || localSettings === void 0 ? void 0 : localSettings.properties) !== "undefined" && localSettings.properties !== null;
            const populateProperties = Array.isArray(localSettings === null || localSettings === void 0 ? void 0 : localSettings.properties) || typeof (localSettings === null || localSettings === void 0 ? void 0 : localSettings.properties) === "boolean" ? localSettings.properties : [localSettings === null || localSettings === void 0 ? void 0 : localSettings.properties];
            const isPopulatePropertyInSettingProperties = populatePropertiesExists ? utils.dynamoose.wildcard_allowed_check(populateProperties, key) : true;
            if (!isPopulatePropertyInSettingProperties) {
                return;
            }
            const subDocument = yield subModel.get(this[prop]);
            const saveDocument = yield PopulateDocument.bind(subDocument)(localSettings, null, { "parentKey": key });
            this[prop] = saveDocument;
        })));
    });
    if (callback) {
        promise.then(() => callback(null, this)).catch((err) => callback(err));
    }
    else {
        return (() => __awaiter(this, void 0, void 0, function* () {
            yield promise;
            return this;
        }))();
    }
}
exports.PopulateDocument = PopulateDocument;
function PopulateDocuments(settings, callback) {
    if (typeof settings === "function") {
        callback = settings;
        settings = {};
    }
    const promise = Promise.all(this.map((document, index) => __awaiter(this, void 0, void 0, function* () {
        this[index] = yield PopulateDocument.bind(document)(settings);
    })));
    if (callback) {
        promise.then(() => callback(null, this)).catch((err) => callback(err));
    }
    else {
        return (() => __awaiter(this, void 0, void 0, function* () {
            yield promise;
            return this;
        }))();
    }
}
exports.PopulateDocuments = PopulateDocuments;
//# sourceMappingURL=Populate.js.map