import { PageModification } from '../shared/PageModification';
import { BOARD_PROPERTIES, btnGroupIdForColumnsSettingsPage } from '../shared/constants';
import { getSettingsTab } from '../routing';
import { Popup } from '../shared/getPopup';
import { cellsAdd, ClearDataButton, RangeName, settingsEditWipLimitOnCells, settingsJiraDOM } from './constants';
import { TableRangeWipLimit } from './table';

export default class WipLimitOnCells extends PageModification {
  static jiraSelectors = {
    panelConfig: `#${btnGroupIdForColumnsSettingsPage}`,
  };

  getModificationId() {
    return `WipLimitByCells-settings-${this.getBoardId()}`;
  }

  async shouldApply() {
    return (await getSettingsTab()) === 'columns';
  }

  waitForLoading() {
    // after button column button
    return Promise.all([this.waitForElement(WipLimitOnCells.jiraSelectors.panelConfig)]);
  }

  loadData() {
    return Promise.all([
      this.getBoardEditData(),
      Promise.all([this.getBoardProperty(BOARD_PROPERTIES.WIP_LIMITS_CELLS)]),
    ]);
  }

  apply([boardData, [settings]]) {
    if (!(boardData && boardData.canEdit)) return;

    this.boardData = boardData;
    // swimlines - this error in word may be save this variant;
    this.swimlane = this.boardData?.swimlanesConfig?.swimlanes;
    this.column = this.boardData?.rapidListConfig?.mappedColumns?.filter(i => !i.isKanPlanColumn);
    this.renderEditButton();
    this.onDOMChange('#columns', () => {
      this.renderEditButton();
    });

    // TODO: with fixed error saved settings name "swimline" => "swimlane"
    settings = settings.map(limit => {
      const cells = [];
      limit.cells.forEach(cell => {
        cells.push({
          column: cell.column,
          showBadge: cell.showBadge,
          swimlane: cell.swimlane ?? cell.swimline,
        });
      });
      limit.cells = cells;
      return limit;
    });

    this.data = settings;
    const handleGetNameLabel = (swimlaneId, columnid) => {
      const swimlane = this.swimlane.find(element => element.id.toString() === swimlaneId.toString());
      const column = this.column.find(element => element.id.toString() === columnid.toString());

      return `${swimlane?.name} / ${column?.name}`;
    };
    this.table = new TableRangeWipLimit({ data: this.data, handleGetNameLabel });
  }

  appendStyles() {
    return `
    <style type="text/css">
    .WipLimitHover:hover{
      transform: scale(1.2);
    }
    .WipLimitHover{
      margin-right:2px;
      margin-left:2px;
    }
    </style>`;
  }

  renderEditButton() {
    const editBtn = this.insertHTML(
      document.getElementById(btnGroupIdForColumnsSettingsPage),
      'beforeend',
      settingsEditWipLimitOnCells()
    );

    this.popup = new Popup({
      title: 'Edit WipLimit on cells',
      onConfirm: this.handleConfirmEditing,
      size: 'large',
      okButtonText: 'Save',
    });

    this.addEventListener(editBtn, 'click', this.handleEditClick);
  }

  handleEditClick = async () => {
    await this.popup.render();

    await this.popup.appendToContent(RangeName());
    await this.popup.appendToContent(cellsAdd(this.swimlane, this.column));
    await this.popup.appendToContent(`<div id=${settingsJiraDOM.table}></div>`);

    await this.popup.appendToContent(ClearDataButton(settingsJiraDOM.ClearData));

    this.editBtn = document.getElementById(settingsJiraDOM.buttonRange);
    this.addEventListener(this.editBtn, 'click', this.handleOnClickAddRange);

    const clearBtn = document.getElementById(settingsJiraDOM.ClearData);
    this.addEventListener(clearBtn, 'click', this.handleClearSettings);

    this.input = document.getElementById(settingsJiraDOM.inputRange);
    this.addEventListener(this.input, 'input', this.handleOnChangeRange);

    await this.table.setDiv(document.getElementById(settingsJiraDOM.table));
    await this.table.render();
  };

  handleOnChangeRange = () => {
    const { value: name } = document.getElementById(settingsJiraDOM.inputRange);
    const haveRange = this.table.findRange(name);
    if (haveRange) {
      this.editBtn.innerText = 'Add cell';
      this.input.dataset.range = name;
    } else {
      this.editBtn.innerText = 'Add range';
      delete this.input.dataset.range;
    }
  };

  handleOnClickAddRange = () => {
    const { value: name, dataset } = document.getElementById(settingsJiraDOM.inputRange);
    const { value: swimlane } = document.getElementById(`${settingsJiraDOM.swimlaneSelect}`).selectedOptions[0];
    const { value: column } = document.getElementById(`${settingsJiraDOM.columnSelect}`).selectedOptions[0];
    const { checked: showBadge } = document.getElementById(`${settingsJiraDOM.showBadge}`);

    if (swimlane === '-' || column === '-') {
      alert('need choose swimlane and column and try again.');
      return;
    }

    if (dataset.range && this.table.findRange(dataset.range)) {
      const cells = {
        swimlane,
        column,
        showBadge,
      };
      this.table.addCells(name, cells);
    } else {
      const addRangeResult = this.table.addRange(name);
      if (addRangeResult) {
        const cells = {
          swimlane,
          column,
          showBadge,
        };
        this.table.addCells(name, cells);
      }
      this.handleOnChangeRange();
    }
  };

  handleClearSettings = () => {
    this.table.setData([]);
    this.popup.unmount();
    this.handleEditClick();
    this.deleteBoardProperty(BOARD_PROPERTIES.WIP_LIMITS_CELLS);
  };

  removeEditBtn() {
    this.editBtn.remove();
  }

  handleConfirmEditing = unmountCallback => {
    const data = this.table.getData();
    this.updateBoardProperty(BOARD_PROPERTIES.WIP_LIMITS_CELLS, data);
    unmountCallback();
  };
}
