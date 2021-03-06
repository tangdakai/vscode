/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/notabstitle';
import errors = require('vs/base/common/errors');
import { IEditorGroup, toResource } from 'vs/workbench/common/editor';
import DOM = require('vs/base/browser/dom');
import { TitleControl } from 'vs/workbench/browser/parts/editor/titleControl';
import { ResourceLabel } from 'vs/workbench/browser/labels';
import { Verbosity } from 'vs/platform/editor/common/editor';
import { TAB_ACTIVE_FOREGROUND, TAB_UNFOCUSED_ACTIVE_FOREGROUND } from 'vs/workbench/common/theme';
import { EventType as TouchEventType, GestureEvent, Gesture } from 'vs/base/browser/touch';

export class NoTabsTitleControl extends TitleControl {
	private titleContainer: HTMLElement;
	private editorLabel: ResourceLabel;

	public setContext(group: IEditorGroup): void {
		super.setContext(group);

		this.editorActionsToolbar.context = { group };
	}

	public create(parent: HTMLElement): void {
		super.create(parent);

		this.titleContainer = parent;

		// Gesture Support
		Gesture.addTarget(this.titleContainer);

		// Pin on double click
		this.toUnbind.push(DOM.addDisposableListener(this.titleContainer, DOM.EventType.DBLCLICK, (e: MouseEvent) => this.onTitleDoubleClick(e)));

		// Detect mouse click
		this.toUnbind.push(DOM.addDisposableListener(this.titleContainer, DOM.EventType.CLICK, (e: MouseEvent) => this.onTitleClick(e)));

		// Detect touch
		this.toUnbind.push(DOM.addDisposableListener(this.titleContainer, TouchEventType.Tap, (e: GestureEvent) => this.onTitleClick(e)));

		// Editor Label
		this.editorLabel = this.instantiationService.createInstance(ResourceLabel, this.titleContainer, void 0);
		this.toUnbind.push(this.editorLabel);
		this.toUnbind.push(this.editorLabel.onClick(e => this.onTitleLabelClick(e)));

		// Right Actions Container
		const actionsContainer = document.createElement('div');
		DOM.addClass(actionsContainer, 'title-actions');
		this.titleContainer.appendChild(actionsContainer);

		// Editor actions toolbar
		this.createEditorActionsToolBar(actionsContainer);

		// Context Menu
		this.toUnbind.push(DOM.addDisposableListener(this.titleContainer, DOM.EventType.CONTEXT_MENU, (e: Event) => this.onContextMenu({ group: this.context, editor: this.context.activeEditor }, e, this.titleContainer)));
		this.toUnbind.push(DOM.addDisposableListener(this.titleContainer, TouchEventType.Contextmenu, (e: Event) => this.onContextMenu({ group: this.context, editor: this.context.activeEditor }, e, this.titleContainer)));
	}

	private onTitleLabelClick(e: MouseEvent): void {
		DOM.EventHelper.stop(e, false);
		if (!this.dragged) {
			setTimeout(() => this.quickOpenService.show()); // delayed to let the onTitleClick() come first which can cause a focus change which can close quick open
		}
	}

	private onTitleDoubleClick(e: MouseEvent): void {
		DOM.EventHelper.stop(e);
		if (!this.context) {
			return;
		}

		const group = this.context;

		this.editorGroupService.pinEditor(group, group.activeEditor);
	}

	private onTitleClick(e: MouseEvent | GestureEvent): void {
		if (!this.context) {
			return;
		}

		const group = this.context;

		// Close editor on middle mouse click
		if (e instanceof MouseEvent && e.button === 1 /* Middle Button */) {
			this.closeEditorAction.run({ group, editor: group.activeEditor }).done(null, errors.onUnexpectedError);
		}

		// Focus editor group unless:
		// - click on toolbar: should trigger actions within
		// - mouse click: do not focus group if there are more than one as it otherwise makes group DND funky
		// - touch: always focus
		else if ((this.stacks.groups.length === 1 || !(e instanceof MouseEvent)) && !DOM.isAncestor(((e as GestureEvent).initialTarget || e.target || e.srcElement) as HTMLElement, this.editorActionsToolbar.getContainer().getHTMLElement())) {
			this.editorGroupService.focusGroup(group);
		}
	}

	protected doRefresh(): void {
		const group = this.context;
		const editor = group && group.activeEditor;
		if (!editor) {
			this.editorLabel.clear();
			this.clearEditorActionsToolbar();

			return; // return early if we are being closed
		}

		const isPinned = group.isPinned(group.activeEditor);
		const isActive = this.stacks.isActive(group);

		// Activity state
		if (isActive) {
			DOM.addClass(this.titleContainer, 'active');
		} else {
			DOM.removeClass(this.titleContainer, 'active');
		}

		// Dirty state
		if (editor.isDirty()) {
			DOM.addClass(this.titleContainer, 'dirty');
		} else {
			DOM.removeClass(this.titleContainer, 'dirty');
		}

		// Editor Label
		const resource = toResource(editor, { supportSideBySide: true });
		const name = editor.getName() || '';

		const labelFormat = this.editorGroupService.getTabOptions().labelFormat;
		let description: string;
		if (labelFormat === 'default' && !isActive) {
			description = ''; // hide description when group is not active and style is 'default'
		} else {
			description = editor.getDescription(this.getVerbosity(labelFormat)) || '';
		}

		let title = editor.getTitle(Verbosity.LONG);
		if (description === title) {
			title = ''; // dont repeat what is already shown
		}

		this.editorLabel.setLabel({ name, description, resource }, { title, italic: !isPinned, extraClasses: ['title-label'] });
		if (isActive) {
			this.editorLabel.element.style.color = this.getColor(TAB_ACTIVE_FOREGROUND);
		} else {
			this.editorLabel.element.style.color = this.getColor(TAB_UNFOCUSED_ACTIVE_FOREGROUND);
		}

		// Update Editor Actions Toolbar
		this.updateEditorActionsToolbar();
	}

	private getVerbosity(style: string): Verbosity {
		switch (style) {
			case 'short': return Verbosity.SHORT;
			case 'long': return Verbosity.LONG;
			default: return Verbosity.MEDIUM;
		}
	}
}
