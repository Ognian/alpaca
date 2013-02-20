/**
 * Alpaca forms engine for jQuery
 */
(function($) {

    var Alpaca;

    /**
     * @namespace Static method to build an Alpaca field instance bound to a DOM element.
     * @description <p>Usage:</p>
     * <p>
     * 1: Binds a control using the contents of $(el) or hands back a previously bound control<br/>
     * <code>
     *     <pre>
     *      Alpaca(el)
     *     </pre>
     * </code>
     * </p>
     * <p>
     * 2: Binds a control to $(el) using the given data (only for non-object types).<br/>
     * <code>
     *     <pre>
     *      Alpaca(el, data)
     *     </pre>
     * </code>
     * </p>
     * <p>
     * 3: Binds a control to $(el) using the given configuration object.<br/>
     * </p>
     * <code>
     *     <pre>
     * Alpaca(el,{
     *   "data" : {Any} field data (optional),
     *   "schema": {Object} field schema (optional),
     *   "options" : {Object} field options (optional),
     *   "view": {Object|String} field view (object or id reference) (optional),
     *   "render": {Function} callback function for replacing default rendering method (optional),
     *   "postRender": {Function} callback function for post-rendering  (optional),
     *   "error": {Function} callback function for error handling  (optional),
     *   "connector": {Alpaca.Connector} connector for retrieving or storing data, schema, options,
     *                view and templates. (optional),
     * });
     *    </pre>
     *</code>
     * @returns {Object} alpaca field instance
     */
    Alpaca = function() {
        var args = Alpaca.makeArray(arguments);
        if (args.length == 0) {
            // illegal
            alert("No arguments - no supported");
            return null;
        }

        // element is the first argument
        var el = args[0];

        // other arguments we may want to figure out
        var data = null;
        var options = null;
        var schema = null;
        var view = null;
        var callback = null;
        var renderedCallback = null;
        var errorCallback = null;
        var connector = null;
        var notTopLevel = false;
        var initialSettings = {};

        if (args.length == 1) {
            // hands back the field instance that is bound directly under the specified element
            // var field = Alpaca(el);
            var domElements = $(el).find(":first");

            var field = null;
            for (var i = 0; i < domElements.length; i++) {
                var domElement = domElements[i];
                var fieldId = $(domElement).attr("alpaca-field-id");
                if (fieldId) {
                    var _field = Alpaca.fieldInstances[fieldId];
                    if (_field) {
                        field = _field;
                    }
                }
            }

            if (field != null) {
                return field;
            } else {
                // otherwise, grab the data inside the element and use that for the control
                var domData = $(el).html();
                $(el).html("");
                data = domData;
            }
        }

        if (args.length >= 2) {
            if (Alpaca.isObject(args[1])) {
                data = args[1].data;
                schema = args[1].schema;
                options = args[1].options;
                view = args[1].view;
                callback = args[1].render;
                renderedCallback = args[1].postRender;
                errorCallback = args[1].error;
                connector = args[1].connector;
                if (args[1].ui) {
                    initialSettings["ui"] = args[1].ui;
                }
                if (args[1].type) {
                    initialSettings["type"] = args[1].type;
                }
                if (!Alpaca.isEmpty(args[1].notTopLevel)) {
                    notTopLevel = args[1].notTopLevel;
                }
            } else {
                // "data" is the second argument
                data = args[1];
                if (Alpaca.isFunction(data)) {
                    data = data();
                }
            }
        }

        // if no error callback is provided, we fall back to a browser alert
        if (Alpaca.isEmpty(errorCallback)) {
            errorCallback = function(error) {
                var message = error.message;
                if (message && Alpaca.isObject(message)) {
                    message = JSON.stringify(message);
                }
                alert("Alpaca error was caught with default error handler: " + message);
            };
        }

        if (Alpaca.isEmpty(connector)) {
            connector = new Alpaca.Connector('default');
        }

        // handle case for null data
        // if schema exits, we will use the settings from the schema
        // we assume a text field
        if (Alpaca.isEmpty(data)) {
            if (Alpaca.isEmpty(schema) && (Alpaca.isEmpty(options) || Alpaca.isEmpty(options.type))) {
                if (Alpaca.isEmpty(options)) {
                    data = "";
                    options = "text";
                } else if (options && Alpaca.isObject(options)) {
                    data = "";
                    options.type = "text";
                }
            }
        }

        // container can either be a dom id or a dom element
        if (el) {
            if (Alpaca.isString(el)) {
                el = $("#" + el);
            }
        }

        // For second or deeper level of fields, default loader should be the one to do loadAll
        // since schema, data, options and view should have already been loaded.
        // Unless we want to load individual fields (other than the templates) using the provided
        // loader, this should be good enough. The benefit is saving time on loader format checking.

        var loadAllConnector = connector;

        if (notTopLevel) {
            loadAllConnector = new Alpaca.Connector('default');
        }

        // wrap rendered callback to allow for UI treatment (dom focus, etc)
        if (!options) {
            options = {};
        }
        if (Alpaca.isUndefined(options.focus)) {
            options.focus = true; // first element in form
        }
        var _renderedCallback = function(control)
        {
            // auto-set the focus?
            if (options && options.focus)
            {
                if (options.focus === true)
                {
                    // pick first element in form
                    if (control.children && control.children.length > 0) {
                        if (control.children.field && control.children.field.length > 0) {
                            $(control.children[0].field[0]).focus()
                        }
                    }
                }
                else
                {
                    // pick a named control
                    var child = control.getControlByPath(options.focus);
                    if (child && child.field && child.field.length > 0) {
                        $(child.field[0]).focus();
                    }
                }
            }

            if (renderedCallback)
            {
                renderedCallback(control);
            }
        };

        loadAllConnector.loadAll({
            "data":data,
            "options": options,
            "schema": schema,
            "view": view
        }, function(loadedData, loadedOptions, loadedSchema, loadedView) {
            return Alpaca.init(el, loadedData, loadedOptions, loadedSchema, loadedView, initialSettings, callback, _renderedCallback, connector, errorCallback);
        }, function (loadError) {
            errorCallback(loadError);
            return null;
        });

        // hand back the field
        return $(el);
    };

    /**
     * @namespace Namespace for all Alpaca Field Class Implementations.
     */
    Alpaca.Fields = { };

    /**
     * @namespace Namespace for all Alpaca Connector Class Implementations.
     */
    Alpaca.Connectors = { };

    // static methods and properties
    $.extend(Alpaca,
    /** @lends Alpaca */
    {
        /**
         * Version number.
         */
        VERSION: "0.1.0",

        /**
         * Makes an array.
         *
         * @param {Any} nonArray A non-array variable.
         * @returns {Array} Array out of the non-array variable.
         */
        makeArray : function(nonArray) {
            return Array.prototype.slice.call(nonArray);
        },

        /**
         * Finds whether the type of a variable is function.
         * @param {Any} obj The variable being evaluated.
         * @returns {Boolean} True if the variable is a function, false otherwise.
         */
        isFunction: function(obj) {
            return Object.prototype.toString.call(obj) === "[object Function]";
        },

        /**
         * Finds whether the type of a variable is string.
         * @param {Any} obj The variable being evaluated.
         * @returns {Boolean} True if the variable is a string, false otherwise.
         */
        isString: function(obj) {
            return (typeof obj == "string");
        },

        /**
         * Finds whether the type of a variable is object.
         * @param {Any} obj The variable being evaluated.
         * @returns {Boolean} True if the variable is an object, false otherwise.
         */
        isObject: function(obj) {
            return $.isPlainObject(obj);
        },

        /**
         * Finds whether the type of a variable is number.
         * @param {Any} obj The variable being evaluated.
         * @returns {Boolean} True if the variable is a number, false otherwise.
         */
        isNumber: function(obj) {
            return (typeof obj == "number");
        },

        /**
         * Finds whether the type of a variable is array.
         * @param {Any} obj The variable being evaluated.
         * @returns {Boolean} True if the variable is an array, false otherwise.
         */
        isArray: function(obj) {
            return Object.prototype.toString.call(obj) === "[object Array]";
        },

        /**
         * Finds whether the type of a variable is boolean.
         * @param {Any} obj The variable being evaluated.
         * @returns {Boolean} True if the variable is a boolean, false otherwise.
         */
        isBoolean: function(obj) {
            return (typeof obj == "boolean");
        },

        /**
         * Finds whether the type of a variable is undefined.
         * @param {Any} obj The variable being evaluated.
         * @returns {Boolean} True if the variable is a undefined, false otherwise.
         */
        isUndefined: function(obj) {
            return (typeof obj == "undefined");
        },

        /**
         * Finds whether a variable is empty.
         * @param {Any} obj The variable being evaluated.
         * @returns {Boolean} True if the variable is empty, false otherwise.
         */
        isEmpty: function(obj) {
            return Alpaca.isUndefined(obj) || obj == null;
        },

        /**
         * Produces a copy of the given JS value.
         *
         * @param thing
         * @return {*}
         */
        copyOf: function(thing) {
            var copy = thing;

            if (Alpaca.isArray(thing) || Alpaca.isObject(thing))
            {
                copy = Alpaca.cloneObject(thing);
            }
            else
            {
                copy = thing;
            }

            return copy;
        },

        /**
         * Splices a string.
         *
         * @param {String} source Source string to be spliced.
         * @param {Integer} splicePoint Splice location.
         * @param {String} splice String to be spliced in.
         * @returns {String} Spliced string
         */
        spliceIn: function(source, splicePoint, splice) {
            return source.substring(0, splicePoint) + splice + source.substring(splicePoint, source.length);
        },

        /**
         * Compacts an array.
         *
         * @param {Array} arr Source array to be compacted.
         * @returns {Array} Compacted array.
         */
        compactArray: function(arr) {
            var n = [], l = arr.length,i;
            for (i = 0; i < l; i++) {
                if (!lang.isNull(arr[i]) && !lang.isUndefined(arr[i])) {
                    n.push(arr[i]);
                }
            }
            return n;
        },

        /**
         * Removes accents from a string.
         *
         * @param {String} str Source string.
         * @returns {String} Cleaned string without accents.
         */
        removeAccents: function(str) {
            return str.replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i").replace(/[òóôõö]/g, "o").replace(/[ùúûü]/g, "u").replace(/[ýÿ]/g, "y").replace(/[ñ]/g, "n").replace(/[ç]/g, "c").replace(/[œ]/g, "oe").replace(/[æ]/g, "ae");
        },

        /**
         * @private
         * @param el
         * @param arr
         * @param fn
         */
        indexOf: function(el, arr, fn) {
            var l = arr.length,i;

            if (!Alpaca.isFunction(fn)) {
                /**
                 * @ignore
                 * @param elt
                 * @param arrElt
                 */
                fn = function(elt, arrElt) {
                    return elt === arrElt;
                };
            }

            for (i = 0; i < l; i++) {
                if (fn.call({}, el, arr[i])) {
                    return i;
                }
            }

            return -1;
        },

        /**
         * Logs a message.
         *
         * @param {String} msg The message to be logged.
         */
        log: function(msg) {
            if (!(typeof console == "undefined")) {
                console.log(msg);
            }
        },

        /**
         * @private
         * Static counter for generating a unique ID.
         */
        uniqueIdCounter: 0,

        /**
         * Default Locale.
         */
        defaultLocale: "en_US",

        /**
         * Sets the default Locale.
         *
         * @param {String} locale New default locale.
         */
        setDefaultLocale: function(locale) {
            this.defaultLocale = locale;
        },

        /**
         * Field Type to Schema Type Mappings.
         */
        defaultSchemaFieldMapping: {},

        /**
         * Registers a field type to schema data type mapping.
         *
         * @param {String} schemaType Schema data type.
         * @param {String} fieldType Field type.
         */
        registerDefaultSchemaFieldMapping: function(schemaType, fieldType) {
            if (schemaType && fieldType) {
                this.defaultSchemaFieldMapping[schemaType] = fieldType;
            }
        },

        /**
         * Field Type to Schema Format Mappings.
         */
        defaultFormatFieldMapping: {},

        /**
         * Registers a field type to schema format mapping.
         *
         * @param {String} format Schema format.
         * @param {String} fieldType Field type.
         */
        registerDefaultFormatFieldMapping: function(format, fieldType) {
            if (format && fieldType) {
                this.defaultFormatFieldMapping[format] = fieldType;
            }
        },

        /**
         * Gets schema type of a variable.
         *
         * @param {Any} data The variable.
         * @returns {String} Schema type of the variable.
         */
        getSchemaType: function (data) {
            // map data types to default field types
            if (Alpaca.isEmpty(data)) {
                return "string";
            }
            if (Alpaca.isObject(data)) {
                return "object";
            }
            if (Alpaca.isString(data)) {
                return "string";
            }
            if (Alpaca.isNumber(data)) {
                return "number";
            }
            if (Alpaca.isArray(data)) {
                return "array";
            }
            if (Alpaca.isBoolean(data)) {
                return "boolean";
            }
            // Last check for data that carries functions -- GitanaConnector case.
            if (typeof data == 'object') {
                return "object";
            }
        },

        /**
         * @private
         *
         * Alpaca Views.
         */
        views: {},

        /**
         * @private
         *
         * View ID Prefix.
         */
        viewIdPrefix: "VIEW_",

        /**
         * Validates a view id.
         *
         * @param {String} id View id being validated.
         *
         * @returns {Boolean} True if the view id is valid, false otherwise.
         */
        isValidViewId : function (id) {
            return Alpaca.startsWith(id, this.viewIdPrefix);
        },

        /**
         * Generates a valid view id.
         *
         * @returns {String} A valid unique view id.
         */
        generateViewId : function () {
            return this.viewIdPrefix + this.generateId();
        },

        /**
         * Registers a view with the framework.
         *
         * @param viewObject
         */
        registerView: function(viewObject)
        {
            var id = viewObject.id;

            if (!id)
            {
                Alpaca.logError("Cannot register view with missing view id: " + id);
                throw new Error("Cannot register view with missing view id: " + id);
            }

            var existingView = this.views[id];
            if (existingView)
            {
                Alpaca.mergeObject(existingView, viewObject);
            }
            else
            {
                this.views[id] = viewObject;
            }

        },

        /**
         * Default view.
         */
        defaultView : "VIEW_WEB_EDIT",

        /**
         * Sets default view as the view with a given id.
         *
         * @param {String} Id of the view being set as default.
         */
        setDefaultView: function(viewId) {
            if (viewId && this.views.hasOwnProperty(viewId)) {
                this.defaultView = viewId;
            }
        },

        /**
         * Retrieves a compiled view by view id.
         *
         * @param viewId
         * @return {*}
         */
        getCompiledView: function(viewId)
        {
            return this.compiledViews[viewId];
        },

        /**
         * Resolves which view handles a given theme and type of operation.
         *
         * @param {String} ui
         * @param {String} type
         *
         * @returns {String} the view id
         */
        lookupCompiledView: function(ui, type)
        {
            var theViewId = null;

            for (var viewId in this.compiledViews)
            {
                var view = this.compiledViews[viewId];

                if (view.ui == ui && view.type == type)
                {
                    theViewId = viewId;
                    break;
                }
            }

            return theViewId;
        },

        /**
         * Registers a template to a view.
         *
         * @param {String} templateId Template id.
         * @param {String|Object} template Either the text of the template or an object containing { "type": "<templateEngineIdentifier>", "template": "<markup>" }
         * @param [String] viewId the optional view id.  If none is provided, then all registrations are to the default view.
         */
        registerTemplate: function(templateId, template, viewId)
        {
            if (!viewId)
            {
                viewId = this.defaultView;
            }

            if (!this.views[viewId])
            {
                this.views[viewId] = {};
                this.views[viewId].id = viewId;
            }

            if (!this.views[viewId].templates)
            {
                this.views[viewId].templates = {};
            }

            this.views[viewId].templates[templateId] = template;

        },

        /**
         * Registers list of templates to a view.
         *
         * @param {Array} templates Templates being registered
         * @param {String} viewId Id of the view that the templates being registered to.
         */
        registerTemplates: function(templates, viewId) {
            for (var templateId in templates) {
                this.registerTemplate(templateId, templates[templateId], viewId);
            }
        },

        /**
         * Registers a message to a view.
         *
         * @param {String} messageId Id of the message being registered.
         * @param {String} message Message to be registered
         * @param {String} viewId Id of the view that the message being registered to.
         */
        registerMessage: function(messageId, message, viewId)
        {
            if (!viewId)
            {
                viewId = this.defaultView;
            }

            if (!this.views[viewId])
            {
                this.views[viewId] = {};
                this.views[viewId].id = viewId;
            }

            if (!this.views[viewId].messages)
            {
                this.views[viewId].messages = {};
            }

            this.views[viewId].messages[messageId] = message;
        },

        /**
         * Registers messages with a view.
         *
         * @param {Array} messages Messages to be registered.
         * @param {String} viewId Id of the view that the messages being registered to.
         */
        registerMessages: function(messages, viewId) {
            for (var messageId in messages) {
                if (messages.hasOwnProperty(messageId)) {
                    this.registerMessage(messageId, messages[messageId], viewId);
                }
            }
        },






        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // STATIC HELPER METHODS (CALLED FROM WITHIN TEMPLATES)
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         * @private
         * Default Mappings for Field Level Templates.
         */
        fieldTemplatePostfix: {
            "controlFieldMessageContainer" : "-controlfield-message-container",
            "controlFieldLabel" : "-controlfield-label",
            "controlFieldContainer":"-controlfield-container",
            "controlFieldHelper":"-controlfield-helper",
            /*
             "controlFieldOuterEl":"-controlfield",
             */
            "fieldSetLegend" : "-fieldset-legend",
            "fieldSetItemsContainer":"-fieldset-items-container",
            "fieldSetHelper":"-fieldset-helper",
            "fieldSetOuterEl":"-fieldset",
            "formButtonsContainer":"-form-buttons-container",
            "formFieldsContainer":"-form-fields-container"
        },

        /**
         * @private
         * Processes field level template.
         *
         * @param {String} object Object that the template is applied to.
         * @param {String} name Template id.
         * @param {Boolean} wrap True if we want the template as a wrapper, false otherwise.
         *
         * @returns {Object} Object rendered by field level template.
         */
        fieldTemplate: function(object, name, wrap) {

            var _this = this;

            var field = object.data;
            var view = object.data.view;

            var html = "";

            if (!name)
                name = "controlFieldLabel";

            // determine which compiled template to use for this template name
            var templateDescriptor = this.getTemplateDescriptor(view, name, field);
            if (wrap) {

                // for wrapping, we get the html source and hand it back
                // first we apply any attr and classes we need

                // get the html source
                var template = templateDescriptor.template.value;
                if ($('.alpaca' + this.fieldTemplatePostfix[name], $(template)).length == 0) {
                    if (this.fieldTemplatePostfix[name]) {
                        template = $(template).addClass("alpaca" + this.fieldTemplatePostfix[name]);
                    }
                }
                html = $(template).outerHTML(true);
            }
            else
            {
                // for non-wrapped, we execute the template straight away

                var label = view.tmpl(templateDescriptor, object.data);
                if (label) {
                    if (this.fieldTemplatePostfix[name]) {
                        if ($('.alpaca' + this.fieldTemplatePostfix[name], label).length == 0) {
                            label.addClass("alpaca" + this.fieldTemplatePostfix[name]);
                        }
                        if (!label.attr("id")) {
                            label.attr("id", object.data.id + this.fieldTemplatePostfix[name]);
                        }
                    }
                    html = label.outerHTML(true);
                } else {
                    html = "";
                }
            }

            return html;
        },


        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // END OF STATIC HELPER METHODS
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////////////



        /**
         * Default date format.
         */
        defaultDateFormat: "mm/dd/yy",

        /**
         * Regular expressions for fields.
         */
        regexps:
        {
            "email": /^[a-z0-9!\#\$%&'\*\-\/=\?\+\-\^_`\{\|\}~]+(?:\.[a-z0-9!\#\$%&'\*\-\/=\?\+\-\^_`\{\|\}~]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,6}$/i,
            "url": /^(http|https):\/\/[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(\:[0-9]{1,5})?(([0-9]{1,5})?\/.*)?$/i,
            "password": /^[0-9a-zA-Z\x20-\x7E]*$/,
            "date": /^(0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])[- /.]\d\d$/,
            "integer": /^([\+\-]?([1-9]\d*)|0)$/,
            "number":/^([\+\-]?((([0-9]+(\.)?)|([0-9]*\.[0-9]+))([eE][+-]?[0-9]+)?))$/,
            "phone":/^(\D?(\d{3})\D?\D?(\d{3})\D?(\d{4}))?$/,
            "ipv4":/^(?:1\d?\d?|2(?:[0-4]\d?|[6789]|5[0-5]?)?|[3-9]\d?|0)(?:\.(?:1\d?\d?|2(?:[0-4]\d?|[6789]|5[0-5]?)?|[3-9]\d?|0)){3}$/,
            "zipcode-five": /^(\d{5})?$/,
            "zipcode-nine": /^(\d{5}(-\d{4})?)?$/
        },

        /**
         * Map of instantiated fields.
         */
        fieldInstances: {},

        /**
         * Maps of field types to field class implementations.
         */
        fieldClassRegistry: {},

        /**
         * Registers an implementation class for a type of field.
         *
         * @param {String} type Field type.
         * @param {Alpaca.Field} fieldClass Field class.
         */
        registerFieldClass: function(type, fieldClass) {
            this.fieldClassRegistry[type] = fieldClass;
        },

        /**
         * Returns the implementation class for a type of field.
         *
         * @param {String} type Field type.
         *
         * @returns {Alpaca.Field} Field class mapped to field type.
         */
        getFieldClass: function(type) {
            return this.fieldClassRegistry[type];
        },

        /**
         * Gets the field type id for a given field implementation class.
         *
         * @param {Alpaca.Field} fieldClass Field class.
         *
         * @returns {String} Field type of the field class.
         */
        getFieldClassType: function(fieldClass) {
            for (var type in this.fieldClassRegistry) {
                if (this.fieldClassRegistry.hasOwnProperty(type)) {
                    if (this.fieldClassRegistry[type] == fieldClass) {
                        return type;
                    }
                }
            }
            return null;
        },

        /**
         * Maps of connector types to connector class implementations.
         */
        connectorClassRegistry: {},

        /**
         * Registers an implementation class for a connector type.
         *
         * @param {String} type cConnect type
         * @param {Alpaca.Connector} connectorClass Connector class.
         */
        registerConnectorClass: function(type, connectorClass) {
            this.connectorClassRegistry[type] = connectorClass;
        },

        /**
         * Returns the implementation class for a connector type.
         *
         * @param {String} type Connect type.
         * @returns {Alpaca.Connector} Connector class mapped to connect type.
         */
        getConnectorClass: function(type) {
            return this.connectorClassRegistry[type];
        },

        /**
         * Replaces each substring of this string that matches the given regular expression with the given replacement.
         *
         * @param {String} text Source string being replaced.
         * @param {String} replace Regular expression for replacing.
         * @param {String} with_this Replacement.
         *
         * @returns {String} Replaced string.
         */
        replaceAll: function(text, replace, with_this) {
            return text.replace(new RegExp(replace, 'g'), with_this);
        },

        /**
         * Creates an element with a given tag name, dom/style attributes and class names.
         *
         * @param {String} tag Tag name.
         * @param {Array} domAttributes DOM attributes.
         * @param {Array} styleAttributes Style attributes.
         * @param {Array} classNames Class names.
         *
         * @returns {Object} New element with the tag name and all other provided attributes.
         */
        element: function(tag, domAttributes, styleAttributes, classNames) {
            var el = $("<" + tag + "/>");

            if (domAttributes) {
                el.attr(domAttributes);
            }
            if (styleAttributes) {
                el.css(styleAttributes);
            }
            if (classNames) {
                for (className in classNames) {
                    el.addClass(className);
                }
            }
        },

        /**
         * Replaces a template with list of replacements.
         *
         * @param {String} template Template being processed.
         * @param {String} substitutions List of substitutions.
         *
         * @returns {String} Replaced template.
         */
        elementFromTemplate: function(template, substitutions) {
            var html = template;
            if (substitutions) {
                for (x in substitutions) {
                    html = Alpaca.replaceAll(html, "${" + x + "}", substitutions[x]);
                }
            }
            return $(html);
        },

        /**
         * Generates a unique alpaca id.
         *
         * @returns {String} The unique alpaca id.
         */
        generateId: function() {
            Alpaca.uniqueIdCounter++;
            return "alpaca" + Alpaca.uniqueIdCounter;
        },

        /**
         * @private
         * Helper function to provide YAHOO later like capabilities.
         */
        later: function(when, o, fn, data, periodic) {
            when = when || 0;
            o = o || {};
            var m = fn, d = $.makeArray(data), f, r;

            if (typeof fn === "string") {
                m = o[fn];
            }

            if (!m) {
                // Throw an error about the method
                throw {
                    name: 'TypeError',
                    message: "The function is undefined."
                }
            }

            /**
             * @ignore
             */
            f = function() {
                m.apply(o, d);
            };

            r = (periodic) ? setInterval(f, when) : setTimeout(f, when);

            return {
                id: r,
                interval: periodic,
                cancel: function() {
                    if (this.interval) {
                        clearInterval(r);
                    } else {
                        clearTimeout(r);
                    }
                }
            };
        },

        /**
         * Finds if an string ends with a given suffix.
         *
         * @param {String} text The string being evaluated.
         * @param {String} suffix Suffix.
         * @returns {Boolean} True if the string ends with the given suffix, false otherwise.
         */
        endsWith : function(text, suffix) {
            return text.indexOf(suffix, text.length - suffix.length) !== -1;
        },

        /**
         * Finds if an string starts with a given prefix.
         *
         * @param {String} text The string being evaluated.
         * @param {String} prefix Prefix
         * @returns {Boolean} True if the string starts with the given prefix, false otherwise.
         */
        startsWith : function(text, prefix) {
            //return (text.match("^" + prefix) == prefix);
            return text.substr(0, prefix.length) === prefix;
        },

        /**
         * Finds if a variable is a URI.
         *
         * @param {Object} obj The variable being evaluated.
         * @returns {Boolean} True if the variable is a URI, false otherwise.
         */
        isUri : function(obj) {
            return Alpaca.isString(obj) && (Alpaca.startsWith(obj, "http://") ||
                    Alpaca.startsWith(obj, "https://") ||
                    Alpaca.startsWith(obj, "/") ||
                    Alpaca.startsWith(obj, "./") ||
                    Alpaca.startsWith(obj, "../"));
        },

        /**
         * Picks a sub-element from an object using a keys array.
         *
         * @param {Object} object Object to be traversed
         * @param {String|Array} keys Either an array of tokens or a dot-delimited string (i.e. "data.user.firstname")
         * @param {String} subprop Optional subproperty to traverse (i.e.. "data.properties.user.properties.firstname")
         *
         * @returns {Object} Sub element mapped to the given key path
         */
        traverseObject : function(object, keys, subprop) {
            if (Alpaca.isString(keys)) {
                keys = keys.split(".");
            }

            var element = null;
            var current = object;

            var key = null;
            do {
                key = keys.shift();
                if (subprop && key == subprop) {
                    key = keys.shift();
                }
                if (!Alpaca.isEmpty(current[key])) {
                    current = current[key];
                    if (keys.length == 0) {
                        element = current;
                    }
                } else {
                    keys = [];
                }
            } while (keys.length > 0);

            return element;
        },

        /**
         * Helper function that executes the given function upon each element in the array
         * The element of the array becomes the "this" variable in the function
         *
         * @param {Array|Object} data Either an array or an object
         * @param {Function} func Function to be executed.
         */
        each : function(data, func) {
            if (Alpaca.isArray(data)) {
                for (var i = 0; i < data.length; i++) {
                    func.apply(data[i]);
                }
            } else if (Alpaca.isObject(data)) {
                for (var key in data) {
                    func.apply(data[key]);
                }
            }
        },

        /**
         * Merges json obj2 into obj1 using a recursive approach.
         *
         * @param {Object} obj1 Destination object.
         * @param {Object} obj2 Source object.
         * @param {Function} validKeyFunction Function used to determine whether to include a given key or not.
         *
         * @returns {Object} Merged object.
         */
        merge : function(obj1, obj2, validKeyFunction) {
            if (!obj1) {
                obj1 = {};
            }
            for (var key in obj2) {
                var valid = true;

                if (validKeyFunction) {
                    valid = validKeyFunction(key);
                }

                if (valid) {
                    if (Alpaca.isEmpty(obj2[key])) {
                        obj1[key] = obj2[key];
                    } else {
                        if (Alpaca.isObject(obj2[key])) {
                            if (!obj1[key]) {
                                obj1[key] = {};
                            }
                            obj1[key] = Alpaca.merge(obj1[key], obj2[key]);
                        } else {
                            obj1[key] = obj2[key];
                        }
                    }
                }
            }

            return obj1;
        },

        /**
         * Merges json "source" into "target" using a recursive approach. The merge will include empty values
         * of obj2 properties.
         *
         * @param {Object} target Target object.
         * @param {Object} source Source object.
         *
         * @returns {Object} Merged object
         */
        mergeObject : function(target, source) {

            if (source && target)
            {
                return this.mergeObject2(source, target);
            }

            return null;
        },

        mergeObject2: function(source, target)
        {
            var isArray = Alpaca.isArray;
            var isObject = Alpaca.isObject;
            var isUndefined = Alpaca.isUndefined;
            var copyOf = Alpaca.copyOf;

            var _merge = function(source, target)
            {
                if (isArray(source))
                {
                    if (isArray(target))
                    {
                        // merge array elements
                        $.each(source, function(index) {
                            target.push(copyOf(source[index]));
                        });
                    }
                    else
                    {
                        // something is already in the target that isn't an ARRAY
                        // skip
                    }
                }
                else if (isObject(source))
                {
                    if (isObject(target))
                    {
                        // merge object properties
                        $.each(source, function(key) {

                            if (isUndefined(target[key])) {
                                target[key] = copyOf(source[key]);
                            } else {
                                target[key] = _merge(source[key], target[key]);
                            }

                        });
                    }
                    else
                    {
                        // something is already in the target that isn't an OBJECT
                        // skip
                    }

                }
                else
                {
                    // otherwise, it's a scalar, always overwrite
                    target = copyOf(source);
                }

                return target;
            };

            _merge(source, target)

            return target;
        },

        /**
         * Clones an object.
         *
         * @param {Object} obj Source object
         * @returns {Object} Cloned object
         */
        cloneObject : function(obj) {
            var clone;

            if (Alpaca.isObject(obj)) {
                clone = {};
                for (var i in obj) {
                    if (obj.hasOwnProperty(i)) {
                        if (Alpaca.isObject(obj[i]) || Alpaca.isArray(obj[i])) {
                            clone[i] = Alpaca.cloneObject(obj[i]);
                        } else {
                            clone[i] = obj[i];
                        }
                    }
                }
            } else if (Alpaca.isArray(obj)) {
                clone = [];
                for (var i = 0 ; i < obj.length ; i++) {
                    if (Alpaca.isObject(obj[i]) || Alpaca.isArray(obj[i])) {
                        clone.push(Alpaca.cloneObject(obj[i]));
                    } else {
                        clone.push(obj[i]);
                    }
                }
            } else {
                clone = obj;
            }

            return clone;
        },

        /**
         * Substitutes a string with a list of tokens.
         *
         * @param text Source string.
         * @param args List of tokens.
         *
         * @returns Substituted string.
         */
        substituteTokens : function(text, args) {

            if (!Alpaca.isEmpty(text)) {
                for (var i = 0; i < args.length; i++) {
                    var token = "{" + i + "}";

                    var x = text.indexOf(token);
                    if (x > -1) {
                        var nt = text.substring(0, x) + args[i] + text.substring(x + 3);
                        text = nt;
                        //text = Alpaca.replaceAll(text, token, args[i]);
                    }
                }
            }
            return text;
        },

        /**
         * Compares two objects.
         *
         * @param {Object} obj1 First object.
         * @param {Object} obj2 Second object.
         *
         * @returns {Boolean} True if two objects are same, false otherwise.
         */
        compareObject : function(obj1, obj2) {
            return equiv(obj1, obj2);
        },

        /**
         * Compares content of two arrays.
         *
         * @param {Array} arr_1 First array.
         * @param {Array} arr_2 Second array.
         * @returns {Boolean} True if two arrays have same content, false otherwise.
         */
        compareArrayContent : function(arr_1, arr_2) {
            var equal = arr_1 && arr_2 && (arr_1.length == arr_2.length);
            if (equal) {
                $.each(arr_1, function(foo, val) {
                    if (!equal)
                        return false;
                    if ($.inArray(val, arr_2) == -1) {
                        equal = false;
                    } else {
                        equal = true;
                    }
                });
            }
            return equal;
        },

        /**
         * Finds whether a variable has empty value or not.
         *
         * @param {Any} val Variable to be evaluated.
         * @returns {Boolean} True if the variable has empty value, false otherwise.
         */
        isValEmpty : function(val) {
            var empty = false;
            if (Alpaca.isEmpty(val)) {
                empty = true;
            } else {
                if (Alpaca.isString(val) && val == "") {
                    empty = true;
                }
                if (Alpaca.isObject(val) && $.isEmptyObject(val)) {
                    empty = true;
                }
                if (Alpaca.isArray(val) && val.length == 0) {
                    empty = true;
                }
                if (Alpaca.isNumber(val) && isNaN(val)) {
                    empty = true;
                }
            }
            return empty;
        },

        /**
         * @private
         *
         * Initial function for setting up field instance and executing callbacks if needed.
         *
         * @param {Object} el Container element.
         * @param {Object} data Field data.
         * @param {Object} options Field options.
         * @param {Object} schema Field schema.
         * @param {Object|String} view Field view.
         * @param {Object} initialSettings any additional settings provided to the top-level Alpaca object
         * @param {Function} callback Render callback.
         * @param {Function} renderedCallback Post-render callback.
         * @param {Alpaca.connector} connector Field connector.
         * @param {Function} errorCallback Error callback.
         *
         * @returns {Alpaca.Field} New field instance.
         */
        init: function(el, data, options, schema, view, initialSettings, callback, renderedCallback, connector, errorCallback) {

            var self = this;

            ///////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // COMPILATION
            //
            ///////////////////////////////////////////////////////////////////////////////////////////////////

            // if they provided an inline view object, we assign an id and store onto views map
            // so that it gets compiled along with the rest
            if (Alpaca.isObject(view)) {
                var viewId = view.id;
                if (!viewId) {
                    view.id = this.generateViewId();
                }
                var parentId = view.parent;
                if (!parentId) {
                    view.parent = "VIEW_WEB_EDIT"; // assume
                }
                this.registerView(view);
                view = view.id;
            }

            // compile all of the views and templates
            this.compile(function(report) {

                if (report.errors && report.errors.length > 0)
                {
                    for (var i = 0; i < report.errors.length; i++)
                    {
                        var viewId = report.errors[i].viewId;
                        var templateId = report.errors[i].templateId;
                        var err = report.errors[i].err;

                        Alpaca.logError("The template: " + templateId + " for view: " + viewId + " failed to compile");
                        Alpaca.logError(JSON.stringify(err));
                    }

                    throw new Error("View compilation failed, cannot initialize Alpaca.  Please check the error logs.");
                }

                self._init(el, data, options, schema, view, initialSettings, callback, renderedCallback, connector, errorCallback);
            });
        },

        _init: function(el, data, options, schema, view, initialSettings, callback, renderedCallback, connector, errorCallback)
        {

            ///////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // VIEW RESOLUTION
            //
            ///////////////////////////////////////////////////////////////////////////////////////////////////


            // make some intelligent guesses about what view id we might default to in case they want to use
            // auto-view selection.  We detect jquery-ui, bootstrap and jquerymobile.
            var fallbackUI = null;
            var fallbackType = null;
            var fallbackViewId = null;

            // if jQuery Mobile is present, fall back to VIEW_MOBILE_EDIT or VIEW_MOBILE_CREATE
            if ($.mobile) {
                fallbackUI = "mobile";
                if (data) {
                    fallbackType = "edit";
                    fallbackViewId = "VIEW_MOBILE_EDIT";
                }
                else {
                    fallbackType = "create";
                    fallbackViewId = "VIEW_MOBILE_CREATE";
                }
            }

            // if Twitter Bootstrap is present, fall back to VIEW_BOOTSTRAP_EDIT or VIEW_BOOTSTRAP_CREATE
            var bootstrapDetected = (typeof $().modal == 'function');
            if (bootstrapDetected) {
                fallbackUI = "bootstrap";
                if (data) {
                    fallbackType = "edit";
                    fallbackViewId = "VIEW_BOOTSTRAP_EDIT";
                } else {
                    fallbackType = "create";
                    fallbackViewId = "VIEW_BOOTSTRAP_CREATE";
                }
            }

            // if no view provided, but they provided "ui" and optionally "type", then we try to auto-select the view
            if (!view)
            {
                var ui = initialSettings.ui;
                var type = initialSettings.type;

                if (!ui)
                {
                    if (!fallbackUI) {
                        fallbackUI = Alpaca.defaultUI;
                    }
                    if (fallbackUI) {
                        ui = fallbackUI;
                    }
                }

                if (ui) {
                    if (!type) {
                        type = fallbackType ? fallbackType : "edit";
                    }

                    Alpaca.logDebug("No view provided but found request for UI: " + ui + " and type: " + type);

                    // see if we can auto-select a view
                    view = this.lookupCompiledView(ui, type);
                    if (view) {
                        Alpaca.logDebug("Found view: " + view);
                    } else {
                        Alpaca.logDebug("No view found for UI: " + ui + " and type: " + type);
                    }
                }
            }

            // if still no view, then default fallback to our detected view or the default
            if (!view)
            {
                Alpaca.logDebug("A view was not specified.");
                if (fallbackViewId)
                {
                    Alpaca.logDebug("Falling back to detected view: " + fallbackViewId);
                    view = fallbackViewId;
                }
                else
                {
                    Alpaca.logDebug("Falling back to default view: " + this.defaultView);
                    view = this.defaultView;
                }
            }

            // debugging: if the view isn't available, we want to report it right away
            if (Alpaca.isString(view))
            {
                if (!this.compiledViews[view])
                {
                    Alpaca.logError("The desired view: " + view + " could not be loaded.  Please make sure it is loaded and not misspelled.");
                    throw new Error("The desired view: " + view + " could not be loaded.  Please make sure it is loaded and not misspelled.");
                }
            }


            ///////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // FIELD INSTANTIATION
            //
            ///////////////////////////////////////////////////////////////////////////////////////////////////


            var field = Alpaca.createFieldInstance(el, data, options, schema, view, connector, errorCallback);
            Alpaca.fieldInstances[field.getId()] = field;

            // allow callbacks defined through view
            if (Alpaca.isEmpty(callback)) {
                callback = field.view.render;
            }
            if (Alpaca.isEmpty(renderedCallback)) {
                renderedCallback = field.view.postRender;
            }

            if (callback != null) {
                callback(field, renderedCallback);
            } else {
                field.render(renderedCallback);
            }

            field.callback = callback;
            field.renderedCallback = renderedCallback;

            return field;
        },

        /**
         * @private
         *
         * Internal method for constructing a field instance.
         *
         * @param {Object} el The dom element to act as the container of the constructed field.
         * @param {Object} data The data to be bound into the field.
         * @param {Object} options The configuration for the field.
         * @param {Object} schema The schema for the field.
         * @param {Object|String} view The view for the field.
         * @param {Alpaca.connector} connector The field connector to be bound into the field.
         * @param {Function} errorCallback Error callback.
         *
         * @returns {Alpaca.Field} New field instance.
         */
        createFieldInstance : function(el, data, options, schema, view, connector, errorCallback) {
            // make sure options and schema are not empty
            if (Alpaca.isValEmpty(options)) options = {};
            if (Alpaca.isValEmpty(schema)) schema = {};
            // options can be a string that identifies the kind of field to construct (i.e. "text")
            if (options && Alpaca.isString(options)) {
                var fieldType = options;
                options = {};
                options.type = fieldType;
            }
            if (!options.type) {
                // if nothing passed in, we can try to make a guess based on the type of data
                if (!schema.type) {
                    schema.type = Alpaca.getSchemaType(data);
                }
                if (schema && schema["enum"]) {
                    if (schema["enum"].length > 3) {
                        options.type = "select";
                    } else {
                        options.type = "radio";
                    }
                } else {
                    options.type = Alpaca.defaultSchemaFieldMapping[schema.type];
                }
                // check if it has format defined
                if (schema.format && Alpaca.defaultFormatFieldMapping[schema.format]) {
                    options.type = Alpaca.defaultFormatFieldMapping[schema.format];
                }
            }
            // find the field class registered for this field type
            var fieldClass = Alpaca.getFieldClass(options.type);
            if (!fieldClass) {
                errorCallback({
                    "message":"Unable to find field class for type: " + options.type,
                    "reason": "FIELD_INSTANTIATION_ERROR"
                });
                return null;
            }
            // if we have data, bind it in
            return new fieldClass(el, data, options, schema, view, connector);
        },

        /**
         * Provides a backwards-compatible version of the former jQuery 1.8.3 parseJSON function (this was changed
         * for jQuery 1.9.0 and introduces all kinds of issues).
         *
         * @param text
         */
        parseJSON: function(text)
        {
            if (!text) {
                return null;
            }

            return $.parseJSON(text);
        },

        /**
         * Compiles all of the views, normalizing them for use by Alpaca.
         * Also compiles any templates that the views may reference.
         *
         * @param cb the callback that gets fired once compilation has ended
         */
        compile: function(cb)
        {
            var self = this;

            //var t1 = new Date().getTime();

            var report = {
                "errors": [],
                "count": 0,
                "successCount": 0
            };

            var finalCallback = function()
            {
                //var t2 = new Date().getTime();
                //console.log("Compilation Exited in: " + (t2-t1)+ " ms");

                cb(report);
            };


            var normalizeViews = function()
            {
                // compile all of the views
                // the result of this compile step is a normalize view (called a CompiledView)
                if (!Alpaca.compiledViews) {
                    Alpaca.compiledViews = {};
                }
                self.compiledViews = Alpaca.compiledViews;
                for (var viewId in self.views) {
                    if (!self.compiledViews[viewId])
                    {
                        var compiledView = new Alpaca.CompiledView(viewId);
                        if (compiledView.compile())
                        {
                            self.compiledViews[viewId] = compiledView;
                        }
                        else
                        {
                            Alpaca.logError("View compilation failed, cannot initialize Alpaca.  Please check the error logs.");
                            throw new Error("View compilation failed, cannot initialize Alpaca.  Please check the error logs.");
                        }
                    }
                }

                finalCallback();
            };



            ////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // VIEW TEMPLATE COMPILATION
            //
            ////////////////////////////////////////////////////////////////////////////////////////////////

            // for all of the views (the original ones, not the compiled ones), walk through them and find any
            // and all templates that need to be compiled
            // compile each and store in a "compiledTemplates" object

            var viewCompileCallback = function(err, view, compiledTemplateId, cacheKey, totalCalls)
            {
                var viewId = view.id;

                report.count++;
                if (err)
                {
                    report.errors.push({
                        "view": viewId,
                        "template": compiledTemplateId,
                        "err": err
                    });
                }
                else
                {
                    report.successCount++;

                    // mark onto the view that the template was compiled for this view
                    // this maps [compiledTemplateId] -> [cacheKey]
                    view.compiledTemplates[compiledTemplateId] = cacheKey;
                }

                if (report.count == totalCalls)
                {
                    //var t2 = new Date().getTime();
                    //console.log("Compilation took: " + (t2-t1) + " ms");
                    if (report.errors.length > 0)
                    {
                        finalCallback();
                    }
                    else
                    {
                        // looks good, so now proceed to normalizing views
                        normalizeViews();
                    }
                }
            };

            var compileViewTemplate = function(view, compiledTemplateId, template, totalCalls)
            {
                var viewId = view.id;

                var type = null;
                if (Alpaca.isObject(template)) {
                    type = template.type;
                    template = template.template;
                }

                // if type isn't resolved, assume jquery tmpl()
                if (!type)
                {
                    type = "text/x-jquery-tmpl";
                }

                // look up the template processor
                var engine = Alpaca.TemplateEngineRegistry.find(type);
                if (!engine)
                {
                    Alpaca.logError("Cannot find template engine for type: " + type);
                    var err = new Error("Cannot find template engine for type: " + type);
                    viewCompileCallback(err, view, compiledTemplateId, cacheKey, totalCalls);
                }

                var cacheKey = viewId + "_" + compiledTemplateId;
                if (!engine.isCached(cacheKey))
                {
                    // compile the template
                    engine.compile(cacheKey, template, function(err, data) {
                        viewCompileCallback(err, view, compiledTemplateId, cacheKey, totalCalls);
                    });
                }
                else
                {
                    // already compiled, so skip
                    viewCompileCallback(null, view, compiledTemplateId, cacheKey, totalCalls);
                }
            };

            // walk through every match and store in an array of functions we'll call
            var functionArray = [];
            for (var viewId in this.views)
            {
                var view = this.views[viewId];
                view.compiledTemplates = {};

                // view templates
                if (view.templates)
                {
                    for (var templateId in view.templates)
                    {
                        var template = view.templates[templateId];

                        functionArray.push(function(view, compiledTemplateId, template) {
                            return function(totalCalls) {
                                compileViewTemplate(view, compiledTemplateId, template, totalCalls);
                            };
                        }(view, "view-" + templateId, template));
                    }
                }

                // field level templates
                if (view.fields)
                {
                    for (var path in view.fields)
                    {
                        if (view.fields[path].templates)
                        {
                            for (var templateId in view.fields[path].templates)
                            {
                                var template = view.fields[path].templates[templateId];

                                functionArray.push(function(view, compiledTemplateId, template) {
                                    return function(totalCalls) {
                                        compileViewTemplate(view, compiledTemplateId, template, totalCalls);
                                    };
                                }(view, "field-" + path + "-" + templateId, template));
                            }
                        }
                    }
                }

                // layout template
                if (view.layout && view.layout.template)
                {
                    var template = view.layout.template;

                    functionArray.push(function(view, compiledTemplateId, template) {
                        return function(totalCalls) {
                            compileViewTemplate(view, compiledTemplateId, template, totalCalls);
                        };
                    }(view, "layoutTemplate", template));
                }

                // global template
                if (view.globalTemplate)
                {
                    var template = view.globalTemplate;

                    functionArray.push(function(view, compiledTemplateId, template) {
                        return function(totalCalls) {
                            compileViewTemplate(view, compiledTemplateId, template, totalCalls);
                        };
                    }(view, "globalTemplate", template));
                }
            }

            // now invoke all of the functions
            // this tells each template to compile
            var totalCalls = functionArray.length;
            for (var i = 0; i < functionArray.length; i++)
            {
                functionArray[i](totalCalls);
            }
        },

        /**
         * Looks up the proper template to be used to handle a requested template id for a view and a field.
         * Performs an override lookup to find the proper template.
         *
         * Hands back a descriptor of everything that is known about the resolved template.
         *
         * @param view
         * @param templateId
         * @param field
         * @return {Object}
         */
        getTemplateDescriptor: function(view, templateId, field)
        {
            var descriptor = {};

            //////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // FIGURE OUT WHERE THE TEMPLATE IS IN THE VIEW CONFIGURATION (RESPECTING FIELD OVERRIDES)
            //
            //////////////////////////////////////////////////////////////////////////////////////////////////

            var _template;
            var _templateType;

            // first consider template level
            if (view.templates && view.templates[templateId])
            {
                _template = view.templates[templateId];
                _templateType = "view";
            }

            // now allow for field overrides
            if (field && field.path)
            {
                var path = field.path;

                if (view && view.fields && view.fields[path] && view.fields[path].templates && view.fields[path].templates[templateId])
                {
                    _template = view.fields[path].templates[templateId];
                    _templateType = "field";
                }
            }

            // finally there are some hardcoded values
            if (templateId == "globalTemplate") {
                _template = "globalTemplate";
                _templateType = "global";
            }

            if (templateId == "layoutTemplate") {
                _template = "layoutTemplate";
                _templateType = "layout";
            }

            descriptor.template = {};
            descriptor.template.id = templateId;
            descriptor.template.type = _templateType;
            descriptor.template.value = _template;


            //////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // ENGINE PROPERTIES
            //
            //////////////////////////////////////////////////////////////////////////////////////////////////

            var type = null;
            var template = _template;
            if (Alpaca.isObject(template)) {
                type = template.type;
                template = template.template;
            }

            // if type isn't resolved, assume jquery tmpl()
            if (!type)
            {
                type = "text/x-jquery-tmpl";
            }

            var engine = Alpaca.TemplateEngineRegistry.find(type);
            if (!engine)
            {
                Alpaca.logError("Cannot find template engine for type: " + type);
                throw new Error("Cannot find template engine for type: " + type);
            }

            descriptor.engine = {};
            descriptor.engine.type = type;
            descriptor.engine.id = engine.id;



            //////////////////////////////////////////////////////////////////////////////////////////////////
            //
            // NOW DETERMINE THE COMPILED TEMPLATE ID FOR THIS TEMPLATE
            //
            //////////////////////////////////////////////////////////////////////////////////////////////////

            var compiledTemplateId = null;
            if (_templateType == "view")
            {
                compiledTemplateId = "view-" + templateId;
            }
            else if (_templateType == "field")
            {
                compiledTemplateId = "field-" + field.path + "-" + templateId;
            }
            else if (_templateType == "layout")
            {
                compiledTemplateId = "layoutTemplate";
            }
            else if (_templateType == "global")
            {
                compiledTemplateId = "globalTemplate";
            }

            descriptor.compiledTemplateId = compiledTemplateId;


            // look up the cacheKey for this compiled template id
            // verify it is in cache
            var cacheKey = view.compiledTemplates[compiledTemplateId];
            if (!cacheKey || !engine.isCached(cacheKey))
            {
                // well, it isn't actually a compiled template
                // thus, we cannot in the end produce a descriptor for it
                return null;
            }

            descriptor.cache = {};
            descriptor.cache.key = cacheKey;

            return descriptor;
        },

        /**
         * Executes a template.
         *
         * @param view
         * @param templateDescriptor
         * @param model
         */
        tmpl: function(view, templateDescriptor, model)
        {
            if (Alpaca.isString(view)) {
                view = this.compiledViews[view];
            }

            var engineType = templateDescriptor.engine.type;
            var compiledTemplateId = templateDescriptor.compiledTemplateId;

            var engine = Alpaca.TemplateEngineRegistry.find(engineType);
            if (!engine)
            {
                Alpaca.logError("Cannot find template engine for type: " + engineType);
                throw new Error("Cannot find template engine for type: " + engineType);
            }

            // execute the template
            var cacheKey = templateDescriptor.cache.key;
            var html = engine.execute(cacheKey, model, function(err) {
                Alpaca.logWarn("The compiled template: " + compiledTemplateId + " for view: " + view.id + " failed to execute: " + JSON.stringify(err));
                throw new Error("The compiled template: " + compiledTemplateId + " for view: " + view.id + " failed to execute: " + JSON.stringify(err));
            });

            return $(html);
        }
    });


    ///////////////////////////////////////////////////////////////////////////////////////////
    //
    // LOGGER
    //
    ///////////////////////////////////////////////////////////////////////////////////////////

    Alpaca.DEBUG = 0;
    Alpaca.INFO = 1;
    Alpaca.WARN = 2;
    Alpaca.ERROR = 3;

    // by default, logging only shows warnings and above
    // to debug, set Alpaca.logLevel = Alpaca.DEBUG
    Alpaca.logLevel = Alpaca.WARN;

    Alpaca.logDebug = function(obj) {
        Alpaca.log(Alpaca.DEBUG, obj);
    };
    Alpaca.logInfo = function(obj) {
        Alpaca.log(Alpaca.INFO, obj);
    };
    Alpaca.logWarn = function(obj) {
        Alpaca.log(Alpaca.WARN, obj);
    };
    Alpaca.logError = function(obj) {
        Alpaca.log(Alpaca.ERROR, obj);
    };

    Alpaca.log = function(level, obj) {

        var methodMap = {
            0: 'debug',
            1: 'info',
            2: 'warn',
            3: 'error'
        };

        if (Alpaca.logLevel <= level)
        {
            var method = methodMap[level];
            if (typeof console !== 'undefined' && console[method])
            {
                console[method].call(console, obj);
            }
        }
    };

    $.alpaca = window.Alpaca = Alpaca;

    /**
     * jQuery friendly method for binding a field to a DOM element.
     * @ignore
     */
    $.fn.alpaca = function() {
        var args = Alpaca.makeArray(arguments);

        // append this into the front of args
        var newArgs = [].concat(this, args);

        // hand back the field instance
        return Alpaca.apply(this, newArgs);
    };

    /**
     * @ignore
     * @param nocloning
     */
    $.fn.outerHTML = function(nocloning) {
        if (nocloning) {
            return $("<div></div>").append(this).html();
        } else {
            return $("<div></div>").append(this.clone()).html();
        }
    };

    /**
     * @ignore
     * @param to
     */
    $.fn.swapWith = function(to) {
        return this.each(function() {
            var copy_to = $(to).clone();
            var copy_from = $(this).clone();
            $(to).replaceWith(copy_from);
            $(this).replaceWith(copy_to);
        });
    };

})(jQuery);
