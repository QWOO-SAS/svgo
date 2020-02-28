'use strict';

var all_plugins = {
  cleanupAttrs: require('../../plugins/cleanupAttrs.js'),
  inlineStyles: require('../../plugins/inlineStyles.js'),
  removeDoctype: require('../../plugins/removeDoctype.js'),
  removeXMLProcInst: require('../../plugins/removeXMLProcInst.js'),
  removeComments: require('../../plugins/removeComments.js'),
  removeMetadata: require('../../plugins/removeMetadata.js'),
  removeTitle: require('../../plugins/removeTitle.js'),
  removeDesc: require('../../plugins/removeDesc.js'),
  removeUselessDefs: require('../../plugins/removeUselessDefs.js'),
  removeXMLNS: require('../../plugins/removeXMLNS.js'),
  removeEditorsNSData: require('../../plugins/removeEditorsNSData.js'),
  removeEmptyAttrs: require('../../plugins/removeEmptyAttrs.js'),
  removeHiddenElems: require('../../plugins/removeHiddenElems.js'),
  removeEmptyText: require('../../plugins/removeEmptyText.js'),
  removeEmptyContainers: require('../../plugins/removeEmptyContainers.js'),
  removeViewBox: require('../../plugins/removeViewBox.js'),
  cleanupEnableBackground: require('../../plugins/cleanupEnableBackground.js'),
  minifyStyles: require('../../plugins/minifyStyles.js'),
  convertStyleToAttrs: require('../../plugins/convertStyleToAttrs.js'),
  convertColors: require('../../plugins/convertColors.js'),
  convertPathData: require('../../plugins/convertPathData.js'),
  convertTransform: require('../../plugins/convertTransform.js'),
  removeUnknownsAndDefaults: require('../../plugins/removeUnknownsAndDefaults.js'),
  removeNonInheritableGroupAttrs: require('../../plugins/removeNonInheritableGroupAttrs.js'),
  removeUselessStrokeAndFill: require('../../plugins/removeUselessStrokeAndFill.js'),
  removeUnusedNS: require('../../plugins/removeUnusedNS.js'),
  prefixIds: require('../../plugins/prefixIds.js'),
  cleanupIDs: require('../../plugins/cleanupIDs.js'),
  cleanupNumericValues: require('../../plugins/cleanupNumericValues.js'),
  cleanupListOfValues: require('../../plugins/cleanupListOfValues.js'),
  moveElemsAttrsToGroup: require('../../plugins/moveElemsAttrsToGroup.js'),
  moveGroupAttrsToElems: require('../../plugins/moveGroupAttrsToElems.js'),
  collapseGroups: require('../../plugins/collapseGroups.js'),
  removeRasterImages: require('../../plugins/removeRasterImages.js'),
  mergePaths: require('../../plugins/mergePaths.js'),
  convertShapeToPath: require('../../plugins/convertShapeToPath.js'),
  convertEllipseToCircle: require('../../plugins/convertEllipseToCircle.js'),
  sortAttrs: require('../../plugins/sortAttrs.js'),
  sortDefsChildren: require('../../plugins/sortDefsChildren.js'),
  removeDimensions: require('../../plugins/removeDimensions.js'),
  removeAttrs: require('../../plugins/removeAttrs.js'),
  removeAttributesBySelector: require('../../plugins/removeAttributesBySelector.js'),
  removeElementsByAttr: require('../../plugins/removeElementsByAttr.js'),
  addClassesToSVGElement: require('../../plugins/addClassesToSVGElement.js'),
  addAttributesToSVGElement: require('../../plugins/addAttributesToSVGElement.js'),
  removeOffCanvasPaths: require('../../plugins/removeOffCanvasPaths.js'),
  removeStyleElement: require('../../plugins/removeStyleElement.js'),
  removeScriptElement: require('../../plugins/removeScriptElement.js'),
  reusePaths: require('../../plugins/reusePaths.js'),
}

var FS = require('fs');
var PATH = require('path');
var yaml = require('js-yaml');

/**
 * Read and/or extend/replace default config file,
 * prepare and optimize plugins array.
 *
 * @param {Object} [config] input config
 * @return {Object} output config
 */
module.exports = function(config) {

    var defaults;
    config = typeof config == 'object' && config || {};

    if (config.plugins && !Array.isArray(config.plugins)) {
        return { error: 'Error: Invalid plugins list. Provided \'plugins\' in config should be an array.' };
    }

    if (config.full) {
        defaults = config;

        if (Array.isArray(defaults.plugins)) {
            defaults.plugins = preparePluginsArray(config, defaults.plugins);
        }
    } else {
        defaults = Object.assign({}, yaml.safeLoad(FS.readFileSync(__dirname + '/../../.svgo.yml', 'utf8')));
        defaults.plugins = preparePluginsArray(config, defaults.plugins || []);
        defaults = extendConfig(defaults, config);
    }

    if ('floatPrecision' in config && Array.isArray(defaults.plugins)) {
        defaults.plugins.forEach(function(plugin) {
            if (plugin.params && ('floatPrecision' in plugin.params)) {
                // Don't touch default plugin params
                plugin.params = Object.assign({}, plugin.params, { floatPrecision: config.floatPrecision });
            }
        });
    }

    if ('datauri' in config) {
        defaults.datauri = config.datauri;
    }

    if (Array.isArray(defaults.plugins)) {
        defaults.plugins = optimizePluginsArray(defaults.plugins);
    }

    return defaults;

};

/**
 * Require() all plugins in array.
 *
 * @param {Object} config
 * @param {Array} plugins input plugins array
 * @return {Array} input plugins array of arrays
 */
function preparePluginsArray(config, plugins) {

    var plugin,
        key;

    return plugins.map(function(item) {

        // {}
        if (typeof item === 'object') {

            key = Object.keys(item)[0];

            // custom
            if (typeof item[key] === 'object' && item[key].fn && typeof item[key].fn === 'function') {
                plugin = setupCustomPlugin(key, item[key]);

            } else {

                plugin = setPluginActiveState(
                    loadPlugin(config, key, item[key].path),
                    item,
                    key
                );
                plugin.name = key;
            }

        // name
        } else {

            plugin = loadPlugin(config, item);
            plugin.name = item;
            if (typeof plugin.params === 'object') {
                plugin.params = Object.assign({}, plugin.params);
            }

        }

        return plugin;

    });

}

/**
 * Extend plugins with the custom config object.
 *
 * @param {Array} plugins input plugins
 * @param {Object} config config
 * @return {Array} output plugins
 */
function extendConfig(defaults, config) {

    var key;

    // plugins
    if (config.plugins) {

        config.plugins.forEach(function(item) {

            // {}
            if (typeof item === 'object') {

                key = Object.keys(item)[0];

                if (item[key] == null) {
                    console.error(`Error: '${key}' plugin is misconfigured! Have you padded its content in YML properly?\n`);
                }

                // custom
                if (typeof item[key] === 'object' && item[key].fn && typeof item[key].fn === 'function') {
                    defaults.plugins.push(setupCustomPlugin(key, item[key]));

                // plugin defined via path
                } else if (typeof item[key] === 'object' && item[key].path) {
                    defaults.plugins.push(setPluginActiveState(loadPlugin(config, undefined, item[key].path), item, key));

                } else {
                    defaults.plugins.forEach(function(plugin) {

                        if (plugin.name === key) {
                            plugin = setPluginActiveState(plugin, item, key);
                        }
                    });
                }

            }

        });

    }

    defaults.multipass = config.multipass;

    // svg2js
    if (config.svg2js) {
        defaults.svg2js = config.svg2js;
    }

    // js2svg
    if (config.js2svg) {
        defaults.js2svg = config.js2svg;
    }

    return defaults;

}

/**
 * Setup and enable a custom plugin
 *
 * @param {String} plugin name
 * @param {Object} custom plugin
 * @return {Array} enabled plugin
 */
function setupCustomPlugin(name, plugin) {
    plugin.active = true;
    plugin.params = Object.assign({}, plugin.params || {});
    plugin.name = name;

    return plugin;
}

/**
 * Try to group sequential elements of plugins array.
 *
 * @param {Object} plugins input plugins
 * @return {Array} output plugins
 */
function optimizePluginsArray(plugins) {

    var prev;

    return plugins.reduce(function(plugins, item) {
        if (prev && item.type == prev[0].type) {
            prev.push(item);
        } else {
            plugins.push(prev = [item]);
        }
        return plugins;
    }, []);

}

/**
 * Sets plugin to active or inactive state.
 *
 * @param {Object} plugin
 * @param {Object} item
 * @param {Object} key
 * @return {Object} plugin
 */
function setPluginActiveState(plugin, item, key) {
    // name: {}
    if (typeof item[key] === 'object') {
        plugin.params = Object.assign({}, plugin.params || {}, item[key]);
        plugin.active = true;

    // name: false
    } else if (item[key] === false) {
        plugin.active = false;

    // name: true
    } else if (item[key] === true) {
        plugin.active = true;
    }

    return plugin;
}

/**
 * Loads default plugin using name or custom plugin defined via path in config.
 *
 * @param {Object} config
 * @param {Object} name
 * @param {Object} path
 * @return {Object} plugin
 */
function loadPlugin(config, name, path) {
    var plugin;

    if (!path) {
        plugin = all_plugins[name];
    } else {
        plugin = require(PATH.resolve(config.__DIR, path));
    }

    return Object.assign({}, plugin);
}
