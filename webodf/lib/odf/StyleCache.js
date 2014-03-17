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
/*jslint emptyblock: false, unparam: false*/
/**
 * @constructor
 * @param {?Element} element
 * @param {!odf.PageLayoutCache} pageLayoutCache
 */
odf.MasterPage = function (element, pageLayoutCache) {
    "use strict";
    var self = this;
    /**
     * @type {!odf.PageLayout}
     */
    this.pageLayout;
    function init() {
        var pageLayoutName;
        if (element) {
            pageLayoutName = element.getAttributeNS(odf.Namespaces.stylens,
                    "page-layout-name");
            self.pageLayout = pageLayoutCache.getPageLayout(pageLayoutName);
        } else {
            self.pageLayout = pageLayoutCache.getDefaultPageLayout();
        }
    }
    init();
};
/*jslint emptyblock: true, unparam: true*/
/**
 * @interface
 */
odf.StylesCache = function () {"use strict"; };
/**
 * @param {!string} name
 * @return {?odf.MasterPage}
 */
odf.StylesCache.prototype.getMasterPage = function (name) {"use strict"; };
/*jslint emptyblock: false, unparam: false*/
/**
 * @constructor
 * @param {!Element} element
 * @param {!odf.StyleParseUtils} styleParseUtils
 * @param {!odf.StylesCache} stylesCache
 * @param {!odf.LocalStyle=} parent
 */
odf.LocalStyle = function (element, styleParseUtils, stylesCache, parent) {
    "use strict";
    /**
     * @type {!odf.TextProperties|undefined}
     */
    this.text;
    /**
     * @type {!odf.ParagraphProperties|undefined}
     */
    this.paragraph;
    /**
     * @type {!odf.GraphicProperties|undefined}
     */
    this.graphic;
    /**
     * @return {?odf.MasterPage}
     */
    this.masterPage = function () {
        var masterPageName = element.getAttributeNS(odf.Namespaces.stylens,
                    "master-page-name"),
            masterPage = null;
        if (masterPageName.length > 1) {
            masterPage = stylesCache.getMasterPage(masterPageName);
        }
        return masterPage;
    };
    /**
     * @param {!odf.LocalStyle} self
     * @return {undefined}
     */
    function init(self) {
        var stylens = odf.Namespaces.stylens,
            family = element.getAttributeNS(stylens, "family"),
            e = null;
        if (family === "graphic" || family === "chart") {
            self.graphic = parent === undefined ? undefined : parent.graphic;
            e = styleParseUtils.getPropertiesElement("graphic-properties", element, e);
            if (e !== null) {
                self.graphic = new odf.GraphicProperties(e, styleParseUtils,
                    self.graphic);
            }
        }
        if (family === "paragraph" || family === "table-cell"
                || family === "graphic" || family === "presentation"
                || family === "chart") {
            self.paragraph = parent === undefined ? undefined : parent.paragraph;
            e = styleParseUtils.getPropertiesElement("paragraph-properties", element, e);
            if (e !== null) {
                self.paragraph = new odf.ParagraphProperties(e, styleParseUtils,
                    self.paragraph);
            }
        }
        if (family === "text" || family === "paragraph"
                || family === "table-cell" || family === "graphic"
                || family === "presentation" || family === "chart") {
            self.text = parent === undefined ? undefined : parent.text;
            e = styleParseUtils.getPropertiesElement("text-properties", element, e);
            if (e !== null) {
                self.text = new odf.TextProperties(e, styleParseUtils, self.text);
            }
        }
    }
    init(this);
};
/**
 * @constructor
 * @param {!odf.StyleParseUtils} styleParseUtils
 * @param {!odf.StylesCache} stylesCache
 */
odf.StylePile = function (styleParseUtils, stylesCache) {
    "use strict";
    var stylens = odf.Namespaces.stylens,
        /**@type{!Object.<!string,!Element>}*/
        styles = {},
        /**@type{!Object.<!string,!Element>}*/
        automaticStyles = {},
        /**@type{!odf.LocalStyle|undefined}*/
        defaultStyle,
        /**@type{!Object.<!string,!odf.LocalStyle>}*/
        parsedAutomaticStyles = {},
        /**@type{!Object.<!string,!odf.LocalStyle>}*/
        parsedStyles = {},
        /**@type{!function(!string,!Array.<!string>):(!odf.LocalStyle|undefined)}*/
        getCommonStyle;
    /**
     * @param {!Element} element
     * @param {!Array.<!string>} visited
     * @return {!odf.LocalStyle}
     */
    function parseStyle(element, visited) {
        var parent,
            parentName,
            style;
        if (element.hasAttributeNS(stylens, "parent-style-name")) {
            parentName = element.getAttributeNS(stylens, "parent-style-name");
            if (visited.indexOf(parentName) === -1) {
                parent = getCommonStyle(parentName, visited);
            }
        }
        style = new odf.LocalStyle(element, styleParseUtils, stylesCache, parent);
        return style;
    }
    /**
     * @param {!string} styleName
     * @param {!Array.<!string>} visited
     * @return {!odf.LocalStyle|undefined}
     */
    getCommonStyle = function (styleName, visited) {
        var style = parsedStyles[styleName],
            element;
        if (!style) {
            element = styles[styleName];
            if (element) {
                visited.push(styleName);
                style = parseStyle(element, visited);
                parsedStyles[styleName] = style;
            }
        }
        return style;
    };
    /**
     * @param {!string} styleName
     * @return {!odf.LocalStyle|undefined}
     */
    function getStyle(styleName) {
        var style = parsedAutomaticStyles[styleName] || parsedStyles[styleName],
            element,
            visited = [];
        if (!style) {
            element = automaticStyles[styleName];
            if (!element) {
                element = styles[styleName];
                if (element) {
                    visited.push(styleName);
                }
            }
            if (element) {
                style = parseStyle(element, visited);
            }
        }
        return style;
    }
    this.getStyle = getStyle;
    /**
     * @param {!Element} style
     * @return {undefined}
     */
    this.addStyle = function (style) {
        var name;
        if (style.hasAttributeNS(stylens, "name")) {
            name = style.getAttributeNS(stylens, "name");
            if (!styles.hasOwnProperty(name)) {
                styles[name] = style;
            }
        }
    };
    /**
     * @param {!Element} style
     * @return {undefined}
     */
    this.addAutomaticStyle = function (style) {
        var name;
        if (style.hasAttributeNS(stylens, "name")) {
            name = style.getAttributeNS(stylens, "name");
            if (!automaticStyles.hasOwnProperty(name)) {
                automaticStyles[name] = style;
            }
        }
    };
    /**
     * @param {!Element} style
     * @return {undefined}
     */
    this.setDefaultStyle = function (style) {
        if (defaultStyle === undefined) {
            defaultStyle = parseStyle(style, []);
        }
    };
    /**
     * @return {!odf.LocalStyle|undefined}
     */
    this.getDefaultStyle = function () {
        return defaultStyle;
    };
};
/**
 * @constructor
 */
odf.ComputedGraphicStyle = function () {
    "use strict";
    /**
     * @type {!odf.ComputedTextProperties}
     */
    this.text = new odf.ComputedTextProperties();
    /**
     * @type {!odf.ComputedParagraphProperties}
     */
    this.paragraph = new odf.ComputedParagraphProperties();
    /**
     * @type {!odf.ComputedGraphicProperties}
     */
    this.graphic = new odf.ComputedGraphicProperties();
};
/**
 * @constructor
 */
odf.ComputedParagraphStyle = function () {
    "use strict";
    /**
     * @type {!odf.ComputedTextProperties}
     */
    this.text = new odf.ComputedTextProperties();
    /**
     * @type {!odf.ComputedParagraphProperties}
     */
    this.paragraph = new odf.ComputedParagraphProperties();
};
/**
 * @constructor
 */
odf.ComputedTextStyle = function () {
    "use strict";
    /**
     * @type {!odf.ComputedTextProperties}
     */
    this.text = new odf.ComputedTextProperties();
};
/**
 * Fast and type-safe access to styling properties an ODF document.
 * When the document changes, update() has to be called to update the
 * information.
 * @constructor
 * @implements {odf.StylesCache}
 * @implements {odf.PageLayoutCache}
 * @param {!odf.ODFDocumentElement} odfroot
 */
odf.StyleCache = function (odfroot) {
    "use strict";
    var self = this,
        /**@type{!{text:!odf.StylePile,paragraph:!odf.StylePile}}*/
        stylePiles,
        /**@type{!Object.<!string,!odf.ComputedTextStyle>}*/
        textStyleCache,
        /**@type{!Object.<!string,!odf.ComputedParagraphStyle>}*/
        paragraphStyleCache,
        /**@type{!Object.<!string,!odf.ComputedGraphicStyle>}*/
        graphicStyleCache,
        /**@type{!odf.StylePile}*/
        textStylePile,
        /**@type{!odf.StylePile}*/
        paragraphStylePile,
        /**@type{!odf.StylePile}*/
        graphicStylePile,
        textns = odf.Namespaces.textns,
        stylens = odf.Namespaces.stylens,
        styleInfo = new odf.StyleInfo(),
        styleParseUtils = new odf.StyleParseUtils(),
        /**@type{!Object.<!string,!Element>}*/
        masterPages,
        /**@type{!Object.<!string,!odf.MasterPage>}*/
        parsedMasterPages,
        /**@type{!odf.MasterPage}*/
        defaultMasterPage,
        /**@type{!odf.PageLayout}*/
        defaultPageLayout,
        /**@type{!Object.<!string,!Element>}*/
        pageLayouts,
        /**@type{!Object.<!string,!odf.PageLayout>}*/
        parsedPageLayouts;
    /**
     * @param {!string} family
     * @param {!string} ns
     * @param {!Element} element
     * @param {!Array.<!string>} chain
     * @return {undefined}
     */
    function appendStyles(family, ns, element, chain) {
        var names = element.getAttributeNS(ns, "class-names"),
            stylename,
            i;
        if (names) {
            names = names.split(" ");
            for (i = 0; i < names.length; i += 1) {
                stylename = names[i];
                if (stylename) {
                    chain.push(family);
                    chain.push(stylename);
                }
            }
        }
    }
    /**
     * @param {!Element} element
     * @param {!Array.<!string>} chain
     * @return {!Array.<!string>}
     */
    function getGraphicStyleChain(element, chain) {
        var stylename = styleInfo.getStyleName("graphic", element);
        if (stylename !== undefined) {
            chain.push("graphic");
            chain.push(stylename);
        }
        return chain;
    }
    /**
     * @param {!Element} element
     * @param {!Array.<!string>} chain
     * @return {!Array.<!string>}
     */
    function getParagraphStyleChain(element, chain) {
        var stylename = styleInfo.getStyleName("paragraph", element);
        // text:p and text:h can have text:class-names
        if (element.namespaceURI === textns &&
                (element.localName === "h" || element.localName === "p")) {
            appendStyles("paragraph", textns, element, chain);
        }
        if (stylename !== undefined) {
            chain.push("paragraph");
            chain.push(stylename);
        }
        return chain;
    }
    /**
     * @param {!Array.<!string>} styleChain
     * @param {!string} propertiesName
     * @param {!string} defaultFamily
     * @return {!Array.<!Object>}
     */
    function createPropertiesChain(styleChain, propertiesName, defaultFamily) {
        var chain = [], i, lastProperties, family, styleName, pile, style,
            properties;
        for (i = 0; i < styleChain.length; i += 2) {
            family =  styleChain[i];
            styleName = styleChain[i + 1];
            pile = /**@type{!odf.StylePile}*/(stylePiles[family]);
            style = pile.getStyle(styleName);
            if (style !== undefined) {
                properties = /**@type{!Object|undefined}*/(style[propertiesName]);
                if (properties !== undefined && properties !== lastProperties) {
                    chain.push(properties);
                    lastProperties = properties;
                }
            }
        }
        pile = /**@type{!odf.StylePile}*/(stylePiles[defaultFamily]);
        style = pile.getDefaultStyle();
        if (style) {
            properties = /**@type{!Object|undefined}*/(style[propertiesName]);
            if (properties !== undefined && properties !== lastProperties) {
                chain.push(properties);
            }
        }
        return chain;
    }
    /**
     * Return the paragraph style for the given content element.
     * @param {!Element} element
     * @return {!odf.ComputedGraphicStyle}
     */
    this.getComputedGraphicStyle = function (element) {
        var styleChain = getGraphicStyleChain(element, []),
            key = styleChain.join("/"),
            computedStyle = graphicStyleCache[key];
        runtime.assert(styleChain.length % 2 === 0, "Invalid style chain.");
        if (computedStyle === undefined) {
            computedStyle = new odf.ComputedGraphicStyle();
            computedStyle.graphic.setGraphicProperties(/**@type{!odf.GraphicProperties|undefined}*/(
                createPropertiesChain(styleChain, "graphic", "graphic")[0]
            ));
            computedStyle.text.setStyleChain(/**@type{!Array.<!odf.TextProperties>}*/(
                createPropertiesChain(styleChain, "text", "graphic")
            ));
            computedStyle.paragraph.setStyleChain(/**@type{!Array.<!odf.ParagraphProperties>}*/(
                createPropertiesChain(styleChain, "paragraph", "graphic")
            ));
            graphicStyleCache[key] = computedStyle;
        }
        return computedStyle;
    };
    /**
     * Return the paragraph style for the given content element.
     * @param {!Element} element
     * @return {!odf.ComputedParagraphStyle}
     */
    this.getComputedParagraphStyle = function (element) {
        var styleChain = getParagraphStyleChain(element, []),
            key = styleChain.join("/"),
            computedStyle = paragraphStyleCache[key];
        runtime.assert(styleChain.length % 2 === 0, "Invalid style chain.");
        if (computedStyle === undefined) {
            computedStyle = new odf.ComputedParagraphStyle();
            computedStyle.text.setStyleChain(/**@type{!Array.<!odf.TextProperties>}*/(
                createPropertiesChain(styleChain, "text", "paragraph")
            ));
            computedStyle.paragraph.setStyleChain(/**@type{!Array.<!odf.ParagraphProperties>}*/(
                createPropertiesChain(styleChain, "paragraph", "paragraph")
            ));
            paragraphStyleCache[key] = computedStyle;
        }
        return computedStyle;
    };
    /**
     * @param {!Element} element
     * @param {!Array.<!string>} chain
     * @return {!Array.<!string>}
     */
    function getTextStyleChain(element, chain) {
        var stylename = styleInfo.getStyleName("text", element),
            parent = element.parentElement;
        // a text:span can have text:class-names
        if (element.localName === "span" && element.namespaceURI === textns) {
            appendStyles("text", textns, element, chain);
        }
        if (stylename !== undefined) {
            chain.push("text");
            chain.push(stylename);
        }
        if (!parent || parent === odfroot) {
            return chain;
        }
        if (parent.namespaceURI === textns &&
                (parent.localName === "p" || parent.localName === "h")) {
            getParagraphStyleChain(parent, chain);
        } else {
            getTextStyleChain(parent, chain);
        }
        return chain;
    }
    /**
     * Return the text style for the given content element.
     * @param {!Element} element
     * @return {!odf.ComputedTextStyle}
     */
    this.getComputedTextStyle = function (element) {
        var styleChain = getTextStyleChain(element, []),
            key = styleChain.join("/"),
            computedStyle = textStyleCache[key];
        runtime.assert(styleChain.length % 2 === 0, "Invalid style chain.");
        if (computedStyle === undefined) {
            computedStyle = new odf.ComputedTextStyle();
            computedStyle.text.setStyleChain(/**@type{!Array.<!odf.TextProperties>}*/(
                createPropertiesChain(styleChain, "text", "text")
            ));
            textStyleCache[key] = computedStyle;
        }
        return computedStyle;
    };
    /**
     * @param {!Element} element
     * @return {!odf.StylePile|undefined}
     */
    function getPileFromElement(element) {
        var family = element.getAttributeNS(stylens, "family");
        return stylePiles[family];
    }
    /**
     * @param {!Element} element
     * @return {undefined}
     */
    function addMasterPage(element) {
        var name = element.getAttributeNS(stylens, "name");
        if (name.length > 0 && !masterPages.hasOwnProperty(name)) {
            masterPages[name] = element;
        }
    }
    /**
     * @param {!string} name
     * @return {!odf.PageLayout}
     */
    function getPageLayout(name) {
        var pageLayout = parsedPageLayouts[name], e;
        if (!pageLayout) {
            e = pageLayouts[name];
            if (e) {
                pageLayout = new odf.PageLayout(e, styleParseUtils, defaultPageLayout);
                parsedPageLayouts[name] = pageLayout;
            } else {
                pageLayout = defaultPageLayout;
            }
        }
        return pageLayout;
    }
    this.getPageLayout = getPageLayout;
    /**
     * @return {!odf.PageLayout}
     */
    this.getDefaultPageLayout = function () {
        return defaultPageLayout;
    };
    /**
     * @param {!string} name
     * @return {?odf.MasterPage}
     */
    function getMasterPage(name) {
        var masterPage = parsedMasterPages[name],
            element;
        if (masterPage === undefined) {
            element = masterPages[name];
            masterPage = element ? new odf.MasterPage(element, self) : null;
        }
        return masterPage;
    }
    this.getMasterPage = getMasterPage;
    /**
     * @return {!odf.MasterPage}
     */
    this.getDefaultMasterPage = function () {
        return defaultMasterPage;
    };
    /**
     * @return {undefined}
     */
    function update() {
        var e,
            pile,
            defaultPageLayoutElement = null,
            defaultMasterPageElement = null;
        textStyleCache = {};
        paragraphStyleCache = {};
        graphicStyleCache = {};
        masterPages = {};
        parsedMasterPages = {};
        parsedPageLayouts = {};
        pageLayouts = {};
        textStylePile = new odf.StylePile(styleParseUtils, self);
        paragraphStylePile = new odf.StylePile(styleParseUtils, self);
        graphicStylePile = new odf.StylePile(styleParseUtils, self);
        stylePiles = {
            text: textStylePile,
            paragraph: paragraphStylePile,
            graphic: graphicStylePile
        };
        // go through <office:styles/>
        e = odfroot.styles.firstElementChild;
        while (e) {
            if (e.namespaceURI === stylens) {
                pile = getPileFromElement(e);
                if (pile) {
                    if (e.localName === "style") {
                        pile.addStyle(e);
                    } else if (e.localName === "default-style") {
                        pile.setDefaultStyle(e);
                    }
                } else if (e.localName === "default-page-layout") {
                    defaultPageLayoutElement = e;
                }
            }
            e = e.nextElementSibling;
        }
        defaultPageLayout = new odf.PageLayout(defaultPageLayoutElement,
                styleParseUtils);
        // go through <office:automatic-styles/>
        e = odfroot.automaticStyles.firstElementChild;
        while (e) {
            if (e.namespaceURI === stylens) {
                pile = getPileFromElement(e);
                if (pile && e.localName === "style") {
                    pile.addAutomaticStyle(e);
                } else if (e.localName === "page-layout") {
                    pageLayouts[e.getAttributeNS(stylens, "name")] = e;
                }
            }
            e = e.nextElementSibling;
        }
        // go through <office:master-styles/>
        e = odfroot.masterStyles.firstElementChild;
        while (e) {
            if (e.namespaceURI === stylens && e.localName === "master-page") {
                defaultMasterPageElement = defaultMasterPageElement || e;
                addMasterPage(e);
            }
            e = e.nextElementSibling;
        }
        defaultMasterPage = new odf.MasterPage(defaultMasterPageElement, self);
    }
    this.update = update;
};
