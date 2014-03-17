/**
 * @license
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */
/*global runtime, odf, console*/
/**
 * Object that retrieved properties lazily from an element.
 * If the element does not define the property it is retrieved from a parent
 * LazyStyleProperties object.
 * @constructor
 * @param {!odf.LazyStyleProperties|undefined} parent
 * @param {!Object.<!string,function():*>} getter
 */
odf.LazyStyleProperties = function (parent, getter) {
    "use strict";
    var /**@type{!Object.<!string,*>}*/
        data = {};
    /**
     * @param {!string} name
     * @return {*}
     */
    this.value = function (name) {
        var /**@type{*}*/
            v;
        if (data.hasOwnProperty(name)) {
            v = data[name];
        } else {
            v = getter[name]();
            if (v === undefined && parent) {
                v = parent.value(name);
            }
            data[name] = v;
        }
        return v;
    };
    /**
     * @param {!odf.LazyStyleProperties|undefined} p
     * @return {undefined}
     */
    this.reset = function (p) {
        parent = p;
        data = {};
    };
};
/**
 * @constructor
 */
odf.StyleParseUtils = function () {
    "use strict";
    var stylens = odf.Namespaces.stylens;
    /**
     * Returns the length split as value and unit, from an ODF attribute
     * @param {!string} length
     * @return {?{value:!number,unit:!string}}
     */
    function splitLength(length) {
        var re = /(-?[0-9]*[0-9][0-9]*(\.[0-9]*)?|0+\.[0-9]*[1-9][0-9]*|\.[0-9]*[1-9][0-9]*)((cm)|(mm)|(in)|(pt)|(pc))/,
            m = re.exec(length);
        if (!m) {
            return null;
        }
        return {value: parseFloat(m[1]), unit: m[3]};
    }
    /**
     * Convert a unit in a string to number of pixels at 96 dpi.
     * If the input value has unit 'px' or is a number, the number is taken as
     * is. Other allowed unit: cm, mm, pt, pc.
     * @param {!string} val
     * @return {!number|undefined}
     */
    function parseLength(val) {
        var n, length, unit;
        length = splitLength(val);
        unit = length && length.unit;
        if (unit === "px") {
            n = length.value;
        } else if (unit === "cm") {
            n = length.value / 2.54 * 96;
        } else if (unit === "mm") {
            n = length.value / 25.4 * 96;
        } else if (unit === "in") {
            n = length.value * 96;
        } else if (unit === "pt") {
            n = length.value / 0.75;
        } else if (unit === "pc") {
            n = length.value * 16;
        }
        return n;
    }
    this.parseLength = parseLength;
    /**
     * Parse a percentage of the form -?([0-9]+(\.[0-9]*)?|\.[0-9]+)%.
     * If parsing fails undefined is returned.
     * @param {!string} value
     * @return {!number|undefined}
     */
    function parsePercent(value) {
        var v = parseFloat(value.substr(0, value.indexOf("%")));
        return isNaN(v) ? undefined : v;
    }
    /**
     * Parse a percentage of the form -?([0-9]+(\.[0-9]*)?|\.[0-9]+)%.
     * If parsing fails undefined is returned.
     * @param {!string} value
     * @param {!string} name
     * @param {!odf.LazyStyleProperties|undefined} parent
     * @return {!number|undefined}
     */
    function parsePositiveLengthOrPercent(value, name, parent) {
        var v = parsePercent(value),
            parentValue;
        if (v !== undefined) {
            if (parent) {
                parentValue = parent.value(name);
            }
            if (parentValue === undefined) {
                v = undefined;
            } else {
                v *= /**@type{!number}*/(parentValue) / 100;
            }
        } else {
            v = parseLength(value);
        }
        return v;
    }
    this.parsePositiveLengthOrPercent = parsePositiveLengthOrPercent;
    /**
     * @param {!string} name
     * @param {!Element} styleElement
     * @param {?Element=} previousPropertyElement
     * @return {?Element}
     */
    function getPropertiesElement(name, styleElement, previousPropertyElement) {
        var e = previousPropertyElement
                ? previousPropertyElement.nextElementSibling
                : styleElement.firstElementChild;
        while (e !== null && (e.localName !== name || e.namespaceURI !== stylens)) {
            e = e.nextElementSibling;
        }
        return e;
    }
    this.getPropertiesElement = getPropertiesElement;
};
