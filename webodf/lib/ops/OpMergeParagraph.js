/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global ops, runtime, odf, core, Node*/

/**
 * Merges two adjacent paragraphs together into the first paragraph. The destination paragraph
 * is expected to always be the first paragraph in DOM order. No content (other than editinfo elements)
 * are removed as part of this operation. Once all child nodes have been shifted from the source paragraph,
 * the source paragraph and any collapsible parents will be cleaned up.
 *
 * @constructor
 * @implements ops.Operation
 */
ops.OpMergeParagraph = function OpMergeParagraph() {
    "use strict";

    var memberid, timestamp,
        /**@type {!boolean}*/
        moveCursor,
        /**@type{!string}*/
        paragraphStyleName,
        /**@type{!number}*/
        sourceStartPosition,
        /**@type{!number}*/
        destinationStartPosition,
        odfUtils = new odf.OdfUtils(),
        domUtils = new core.DomUtils(),
        /**@const*/
        textns = odf.Namespaces.textns;

    /**
     * @param {!ops.OpMergeParagraph.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        moveCursor = data.moveCursor;
        paragraphStyleName = data.paragraphStyleName;
        sourceStartPosition = parseInt(data.sourceStartPosition, 10);
        destinationStartPosition = parseInt(data.destinationStartPosition, 10);
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * Merges the source paragraph into the destination paragraph.
     * @param {!Element} destination Paragraph to merge content into
     * @param {!Element} source Paragraph to merge content from
     * @return {undefined}
     */
    function mergeParagraphs(destination, source) {
        var child;

        child = source.firstChild;
        while (child) {
            if (child.localName === 'editinfo'
                || (odfUtils.isGroupingElement(child) && odfUtils.hasNoODFContent(child))) {
                // Empty spans need to be cleaned up on merge, as remove text only removes things that contain text content
                source.removeChild(child);
            } else {
                // TODO It should be the view's responsibility to clean these up. This would fix #431
                destination.appendChild(child);
            }
            child = source.firstChild;
        }
    }

    /**
     * Remove all the text nodes within the supplied range. These are expected to be insignificant whitespace only.
     * Assertions will be thrown if this is not the case.
     *
     * @param {!Range} range
     * @return {undefined}
     */
    function removeTextNodes(range) {
        var textNodes;

        if (range.collapsed) {
            return;
        }

        domUtils.splitBoundaries(range);
        textNodes = odfUtils.getTextElements(range, false, true);
        textNodes.forEach(function(node) {
            var textNode = /**@type{!Text}*/(node);

            runtime.assert(textNode.nodeType === Node.TEXT_NODE, "Expected node type 3 (Node.TEXT_NODE), found node type " + textNode.nodeType);
            if (textNode.length > 0) {
                runtime.assert(odfUtils.isODFWhitespace(textNode.data),
                    "Non-whitespace node found between paragraph boundary and first or last step");

                // Significant whitespace is only ever the first space char in a series of space.
                // Therefore, only need to check the first character to ensure complete string is insignificant whitespace.
                runtime.assert(odfUtils.isSignificantWhitespace(textNode, 0) === false,
                    "Significant whitespace node found between paragraph boundary and first or last step");
            } else {
                // This is not a critical issue, but indicates an operation somewhere isn't correctly normalizing text nodes
                // after manipulation of the DOM.
                runtime.log("WARN: Empty text node found during merge operation");
            }
            textNode.parentNode.removeChild(textNode);
        });
    }

    /**
     * Remove all insignificant whitespace between the paragraph node boundaries and the first and last step within the
     * paragraph. This prevents this insignificant whitespace accidentally becoming significant whitespace during the
     * merge.
     *
     * @param {!core.StepIterator} stepIterator
     * @param {!Element} paragraphElement
     * @return {undefined}
     */
    function trimInsignificantWhitespace(stepIterator, paragraphElement) {
        var range = paragraphElement.ownerDocument.createRange();

        // Discard insignificant whitespace between the start of the paragraph node and the first step in the paragraph
        stepIterator.setPosition(paragraphElement, 0);
        stepIterator.roundToNextStep();
        range.setStart(paragraphElement, 0);
        range.setEnd(stepIterator.container(), stepIterator.offset());
        removeTextNodes(range);

        // Discard insignificant whitespace between the last step in the paragraph and the end of the paragraph node
        stepIterator.setPosition(paragraphElement, paragraphElement.childNodes.length);
        stepIterator.roundToPreviousStep();
        range.setStart(stepIterator.container(), stepIterator.offset());
        range.setEnd(paragraphElement, paragraphElement.childNodes.length);
        removeTextNodes(range);
    }

    /**
     * @param {!ops.OdtDocument} odtDocument
     * @param {!number} steps
     * @returns {!Element}
     */
    function getParagraphAtStep(odtDocument, steps) {
        var domPoint = odtDocument.convertCursorStepToDomPoint(steps),
            paragraph = odfUtils.getParagraphElement(domPoint.node, domPoint.offset);
        runtime.assert(Boolean(paragraph), "Paragraph not found at step " + steps);
        return /**@type{!Element}*/(paragraph);
    }

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{!ops.OdtDocument}*/(document),
            sourceParagraph,
            destinationParagraph,
            cursor = odtDocument.getCursor(memberid),
            rootNode = odtDocument.getRootNode(),
            collapseRules = new odf.CollapsingRules(rootNode),
            stepIterator = odtDocument.createStepIterator(rootNode, 0, [odtDocument.getPositionFilter()], rootNode),
            downgradeOffset;

        // Asserting a specific order for destination + source makes it easier to decide which ends to upgrade
        runtime.assert(destinationStartPosition < sourceStartPosition,
                        "Destination paragraph (" + destinationStartPosition + ") must be " +
                        "before source paragraph (" + sourceStartPosition + ")");

        destinationParagraph = getParagraphAtStep(odtDocument, destinationStartPosition);
        sourceParagraph = getParagraphAtStep(odtDocument, sourceStartPosition);

        // Merging is not expected to be able to re-order document content. It is only ever removing a single paragraph
        // split and merging the content back into the previous paragraph. This helps ensure OT behaviour is straightforward
        stepIterator.setPosition(sourceParagraph, 0);
        stepIterator.previousStep();
        runtime.assert(domUtils.containsNode(destinationParagraph, stepIterator.container()),
                        "Destination paragraph must be adjacent to the source paragraph");

        trimInsignificantWhitespace(stepIterator, destinationParagraph);
        downgradeOffset = destinationParagraph.childNodes.length;
        trimInsignificantWhitespace(stepIterator, sourceParagraph);

        mergeParagraphs(destinationParagraph, sourceParagraph);
        // All children have been migrated, now consume up the source parent chain
        collapseRules.mergeChildrenIntoParent(sourceParagraph);

        // Merging removes a single step between the boundary of the two paragraphs
        odtDocument.emit(ops.OdtDocument.signalStepsRemoved, {position: sourceStartPosition - 1});

        // Downgrade trailing spaces at the end of the destination paragraph, and the beginning of the source paragraph.
        // These are the only two places that might need downgrading as a result of the merge.
        // NB: if the destination paragraph was empty before the merge, this might actually check the
        // paragraph just prior to the destination. However, as the downgrade also checks 2 steps after the specified
        // one though, there is no harm caused by this.
        stepIterator.setPosition(destinationParagraph, downgradeOffset);
        stepIterator.roundToClosestStep();
        if (!stepIterator.previousStep()) {
            // If no previous step is found, round back up to the next available step
            stepIterator.roundToNextStep();
        }
        odtDocument.downgradeWhitespaces(stepIterator);

        if (paragraphStyleName) {
            destinationParagraph.setAttributeNS(textns, "text:style-name", paragraphStyleName);
        } else {
            destinationParagraph.removeAttributeNS(textns, "style-name");
        }

        if (cursor && moveCursor) {
            odtDocument.moveCursor(memberid, sourceStartPosition - 1, 0);
            odtDocument.emit(ops.Document.signalCursorMoved, cursor);
        }

        odtDocument.fixCursorPositions();
        odtDocument.getOdfCanvas().refreshSize();
        // TODO: signal also the deleted paragraphs, so e.g. SessionView can clean up the EditInfo
        odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
            paragraphElement: destinationParagraph,
            memberId: memberid,
            timeStamp: timestamp
        });

        odtDocument.getOdfCanvas().rerenderAnnotations();
        return true;
    };

    /**
     * @return {!ops.OpMergeParagraph.Spec}
     */
    this.spec = function () {
        return {
            optype: "MergeParagraph",
            memberid: memberid,
            timestamp: timestamp,
            moveCursor: moveCursor,
            paragraphStyleName: paragraphStyleName,
            sourceStartPosition: sourceStartPosition,
            destinationStartPosition: destinationStartPosition
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    moveCursor: !boolean,
    paragraphStyleName: !string,
    sourceStartPosition: !number,
    destinationStartPosition: !number
}}*/
ops.OpMergeParagraph.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    moveCursor: !boolean,
    paragraphStyleName: !string,
    sourceStartPosition: !number,
    destinationStartPosition: !number
}}*/
ops.OpMergeParagraph.InitSpec;
