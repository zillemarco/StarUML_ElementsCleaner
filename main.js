/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, $, _, window, app, type, appshell, document */

define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils      = app.getModule("utils/ExtensionUtils"),
        PanelManager        = app.getModule("utils/PanelManager"),
        Repository          = app.getModule("core/Repository"),
        SelectionManager    = app.getModule("engine/SelectionManager"),
        CommandManager      = app.getModule("command/CommandManager"),
        Commands            = app.getModule("command/Commands"),
        MenuManager         = app.getModule("menu/MenuManager"),
        ContextMenuManager  = app.getModule("menu/ContextMenuManager"),
        ModelExplorerView   = app.getModule("explorer/ModelExplorerView"),
        ProjectManager      = app.getModule("engine/ProjectManager"),
        Engine              = app.getModule("engine/Engine");

    var removableElementsPanelTemplate = require("text!removable-elements-panel.html"),
        removableElementItemTemplate = require("text!removable-element-item.html"),
        removableElementsPanel,
        listView,
        $removableElementsPanel,
        $listView,
        $title,
        $close,
        $refresh,
        $button = $("<a id='toolbar-elements-cleaner' href='#' title='Elements cleaner'></a>");

    var CMD_ELEMENTS_CLEANER_TOOL = "tools.elementscleaner";

    /**
     * DataSource for ListView
     * @type {kendo.data.DataSource}
     */
    var dataSource = new kendo.data.DataSource();

    /**
     * Clear All Removable Elements Items
     */
    function clearRemovableElementsItems() {
        dataSource.data([]);
    }

    /**
     * Add a Removable Element Item
     * @param {Relationship} rel
     * @param {Model} elem
     * @param {string} role
     */
    function addRemovableElementItem(elem) {
        dataSource.add({
            id: elem._id,
            icon: elem.getNodeIcon(),
            name: elem.name,
            type: elem.getClassName()
        });
    }

    function findRemovableElements()
    {
        clearRemovableElementsItems();

        var project = ProjectManager.getProject();

        var ownedElementsCount = project.ownedElements.length,
            i = 0;
        
        for(; i < ownedElementsCount; i++)
            _findRemovableElementsInternal(project.ownedElements[i]);
    }

    function _findRemovableElementsInternal(element)
    {
        var isElement = element instanceof type.Element,
            isModel = element instanceof type.Model,
            isProject = element instanceof type.Project,
            isDiagram = element instanceof type.Diagram,
            isUMLModel = element instanceof type.UMLModel,
            isView = element instanceof type.View;

        if (isElement && isModel && !isDiagram && !isProject && !isUMLModel && !isView)
        {
            var views = Repository.getViewsOf(element);

            if(views.length == 0)
                addRemovableElementItem(element);
        }
        
        var ownedElementsCount = element.ownedElements.length,
            i = 0;
        
        for(; i < ownedElementsCount; i++)
            _findRemovableElementsInternal(element.ownedElements[i]);
    }

    /**
     * Show Removable Elements Panel
     */
    function show() {
        removableElementsPanel.show();
    }

    /**
     * Hide Removable Elements Panel
     */
    function hide() {
        removableElementsPanel.hide();
    }

    function _handleRemoveElements()
    {
        var selectedItems = _getSelectedRemovableItems();

        if (selectedItems)
        {
            var selectedItemsCount = selectedItems.length,
                i = 0;
            
            var elementsToDelete = new Array();

            for(; i < selectedItemsCount; i++)
            {
                var element = Repository.get(selectedItems[i].id);

                if(element)
                    elementsToDelete.push(element);
            }

            if(elementsToDelete.length > 0)
            {
                Engine.deleteElements(elementsToDelete, []);
                findRemovableElements();
            }
        }
    }

    function _handleSelectRemovableElementOnModelExplorerView()
    {
        var selectedItems = _getSelectedRemovableItems();

        if (selectedItems && selectedItems.length > 0)
        {
            var element = Repository.get(selectedItems[0].id);

            if (element) {
                ModelExplorerView.select(element, true);
            }
        }
    }

    function _getSelectedRemovableItems()
    {        
        if (listView.select().length > 0)
        {
            var data = dataSource.view(),
                selectedItems = $.map(listView.select(), function(item) {
                    return data[$(item).index()];
                });
            return selectedItems;
        }
    }

    /**
     * Setup ContextMenu
     */
    function _setupContextMenu()
    {
        var CMD_REMOVE_ELEMENTS          = "elementscleaner.removeElements",
            CMD_FIND_IN_MODEL_EXPLORER  = "elementscleaner.selectInModelExplorer";

        CommandManager.register("Remove elements",      CMD_REMOVE_ELEMENTS,        _handleRemoveElements);
        CommandManager.register("Select in Explorer",   CMD_FIND_IN_MODEL_EXPLORER, _handleSelectRemovableElementOnModelExplorerView);

        var CONTEXT_MENU = "context-menu-elements-cleaner";
        var contextMenu;
        contextMenu = ContextMenuManager.addContextMenu(CONTEXT_MENU, "#elements-cleaner-view div.listview");
        contextMenu.addMenuItem(CMD_REMOVE_ELEMENTS);
        contextMenu.addMenuItem(CMD_FIND_IN_MODEL_EXPLORER);
    }
    /**
     * Initialize Extension
     */
    function init()
    {
        // Load our stylesheet
        ExtensionUtils.loadStyleSheet(module, "styles.less");

        // Toolbar Button
        $("#toolbar .buttons").append($button);
        $button.click(function () {
            CommandManager.execute(CMD_ELEMENTS_CLEANER_TOOL);
        });

        // Setup RemovableElementsPanel
        $removableElementsPanel = $(removableElementsPanelTemplate);
        $title = $removableElementsPanel.find(".title");
        $close = $removableElementsPanel.find(".close");
        $close.click(function () {
            hide();
        });
        $refresh = $removableElementsPanel.find("#elements-cleaner-panel-refresh");
        $refresh.click(function () {
            findRemovableElements();
        });

        removableElementsPanel = PanelManager.createBottomPanel("?", $removableElementsPanel, 60);

        // Setup Removable Elements List
        $listView = $removableElementsPanel.find(".listview");
        $listView.kendoListView({
            dataSource: dataSource,
            template: removableElementItemTemplate,
            selectable: "multiple"
        });
        listView = $listView.data("kendoListView");
        $listView.dblclick(function (e) {
            _handleSelectRemovableElementOnModelExplorerView();
        });

        // Register Commands
        CommandManager.register("Clear elements", CMD_ELEMENTS_CLEANER_TOOL, function() {
            findRemovableElements();
            show();
        });

        // Setup Menus
        var menu = MenuManager.getMenu(Commands.TOOLS);
        menu.addMenuDivider();
        menu.addMenuItem(CMD_ELEMENTS_CLEANER_TOOL, ["Ctrl-Shift-Delete"]);

        _setupContextMenu();
    }

    // Initialize Extension
    init();

});