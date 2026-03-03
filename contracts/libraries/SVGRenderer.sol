// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ColorPalette} from "./ColorPalette.sol";

/// @title SVGRenderer - Pure SVG generation from decoded pixel array
/// @notice Generates SVG strings from flat pixel arrays using ColorPalette hex values
/// @dev Used by CanvasNFT.tokenURI() to produce on-chain SVG images.
///      Uses row-batched string building to avoid O(n^2) abi.encodePacked overhead.
library SVGRenderer {
    using Strings for uint256;

    /// @notice Generate an SVG string from a flat pixel array
    /// @param width The canvas width
    /// @param height The canvas height
    /// @param pixels Flat array of color indices: pixels[y * width + x] = colorIndex
    /// @return The complete SVG string
    function generateSVG(
        uint16 width,
        uint16 height,
        uint8[] memory pixels
    ) internal pure returns (string memory) {
        // SVG header with viewBox matching canvas dimensions for 1:1 pixel mapping
        string memory header = string(abi.encodePacked(
            "<svg viewBox='0 0 ",
            uint256(width).toString(),
            " ",
            uint256(height).toString(),
            "' xmlns='http://www.w3.org/2000/svg' shape-rendering='crispEdges'>"
        ));

        // Build row strings and accumulate every BATCH_SIZE rows to limit O(n^2) copies
        // For a 16x16 canvas: 16 rows, each row produces up to 16 rect elements
        // For a 256x256 canvas: 256 rows, each row produces up to 256 rect elements
        bytes memory result = bytes(header);

        for (uint256 y = 0; y < height; y++) {
            // Build one row of rects
            bytes memory rowRects;
            string memory yStr = y.toString();

            for (uint256 x = 0; x < width; x++) {
                uint256 idx = y * uint256(width) + x;
                uint8 colorIndex = pixels[idx];
                if (colorIndex != 0) {
                    uint24 rgb = ColorPalette.getColor(colorIndex);
                    rowRects = abi.encodePacked(
                        rowRects,
                        "<rect x='",
                        x.toString(),
                        "' y='",
                        yStr
                    );
                    rowRects = abi.encodePacked(
                        rowRects,
                        "' width='1' height='1' fill='#",
                        _toHexColor(rgb),
                        "'/>"
                    );
                }
            }

            // Append row to result
            if (rowRects.length > 0) {
                result = abi.encodePacked(result, rowRects);
            }
        }

        result = abi.encodePacked(result, "</svg>");
        return string(result);
    }

    /// @notice Convert a 24-bit RGB value to a 6-character hex color string
    /// @param rgb The 24-bit RGB value (e.g., 0xFF6600)
    /// @return The 6-character hex string (e.g., "FF6600")
    function _toHexColor(uint24 rgb) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789ABCDEF";
        bytes memory r = new bytes(6);
        r[0] = hexChars[(rgb >> 20) & 0xF];
        r[1] = hexChars[(rgb >> 16) & 0xF];
        r[2] = hexChars[(rgb >> 12) & 0xF];
        r[3] = hexChars[(rgb >> 8) & 0xF];
        r[4] = hexChars[(rgb >> 4) & 0xF];
        r[5] = hexChars[rgb & 0xF];
        return string(r);
    }
}
