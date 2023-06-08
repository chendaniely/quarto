/*
 * edit-link.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import React, { useEffect, useRef, useState } from "react";

import { Button, Select, TabList, Tab, TabValue, SelectTabEvent, SelectTabData, Field, Input, makeStyles } from "@fluentui/react-components"

import { AttrEditInput, LinkCapabilities, LinkEditResult, LinkProps, LinkTargets, LinkType, UIToolsAttr } from "editor-types";

import {  FormikProps, useField, useFormikContext } from "formik";

import { FormikDialog, FormikTextInput, showValueEditorDialog } from "ui-widgets";

import { editAttrFields } from "./edit-attr";

import { t } from './translate';

import styles from "./styles.module.scss";
import { fluentTheme } from "../theme";


export function editLink(attrUITools: UIToolsAttr) {
  return async (link: LinkProps, targets: LinkTargets,  capabilities: LinkCapabilities)
  : Promise<LinkEditResult | null> => {
    const { id, classes, keyvalue, ...linkAttr } = link;
    linkAttr.title = linkAttr.title || '';
    const value = {
      value: { ...attrUITools.propsToInput({ id, classes, keyvalue }), ...linkAttr },
      action: "edit" as ("edit" | "remove")
    };
    const result = await showValueEditorDialog(EditLinkDialog, value, { targets, capabilities });
    if (result && result.value.href && result.value.text) {
      const { id, classes, style, keyvalue, ...linkAttr } = result.value;
      return {
        link: { ...attrUITools.inputToProps({ id, classes, style, keyvalue }), ...linkAttr },
        action: result.action
      }
    } else {
      return null;
    }
  }
}

interface EditLinkDialogFields extends AttrEditInput {
  readonly type: LinkType;
  readonly text: string;
  readonly href: string;
  readonly heading?: string;
  readonly title?: string;
}

interface EditLinkDialogValues {
  value: EditLinkDialogFields;
  action: "edit" | "remove"
}

interface EditLinkDialogOptions {
  capabilities: LinkCapabilities;
  targets: LinkTargets;
}

const EditLinkDialog: React.FC<{ 
  values: EditLinkDialogValues,
  options: EditLinkDialogOptions,
  onClosed: (values?: EditLinkDialogValues) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const [selectedTab, setSelectedTab] = useState<TabValue>("link");
  const onTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value);
  };

  const close = (values?: EditLinkDialogValues) => {
    setIsOpen(false);
    if (values) {
      const type = asLinkType(values.value.type);
      if (type === LinkType.Heading) {
        props.onClosed({
          value: { 
            ...values.value,
            type,
            href: values.value.href,
            text: values.value.href,
            heading: values.value.href
          },
          action: values.action
        })
      } else {
        props.onClosed({
          ...values,
          value: { ...values.value, type, heading: undefined }
        });
      }
    } else {
      props.onClosed();
    }
   
  }

  const removeButton = props.values.value.href ?
    <Button onClick={() => close({ value: props.values.value, action: 'remove' })}>
      {t("Remove Link")}
    </Button> : undefined;
 
   
  const attributesPanel = 
    <div className={styles.editAttributesPanel}>
      {editAttrFields()}
    </div>;

  return (
    <FormikDialog
      title={t("Link")} 
      theme={fluentTheme()}
      isOpen={isOpen} 
      initialValues={props.values.value} 
      leftButtons={removeButton}
      onSubmit={(value) => close({ value, action: "edit" })}
      onReset={() => close()}
    >
       {(formikProps: FormikProps<EditLinkDialogFields>) => {
          const type = asLinkType(formikProps.values.type);
          if (props.options.capabilities.attributes) {
            return (
              <>
              <TabList
              selectedValue={selectedTab} 
              onTabSelect={onTabSelect}
              >
                <Tab id="link" value="link">{t("Link")}</Tab>
                {type !== LinkType.Heading 
                  ? <Tab id="attributes" value="attributes">{t("Attributes")}</Tab> 
                  : null
                }
              </TabList>
              <div>
              {selectedTab === "link" && <LinkPanel options={props.options}/>}
              {selectedTab === "attributes" && attributesPanel}
            </div>
              </>
            )
          } else {
            return  <LinkPanel options={props.options}/>;
          }
        }
      }
      
    </FormikDialog>
  )
}


const LinkPanel: React.FC<{options: EditLinkDialogOptions }> = props => {
    
  const suggestionsForType = (linkType: LinkType) => {
    switch (asLinkType(linkType)) {
      case LinkType.URL:
        return [];
      case LinkType.Heading:
        return props.options.targets.headings.map(heading => ({
          label: heading.text,
          value: heading.text,
        }));
      case LinkType.ID:
        return props.options.targets.ids.map(id => ({ value: '#' + id }));
    }
  };

  const defaultHRefForType = (linkType: LinkType) => {
    const suggestions = suggestionsForType(linkType);
    return suggestions.length ? suggestions[0].value : '';
  };

  const formik = useFormikContext();

  const [ typeField ] = useField("type");
  const [ hrefField ] = useField("href");

  const type = asLinkType(typeField.value);

  const autoFocusRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTimeout(() => {
      autoFocusRef.current?.focus();
    }, 0);
  }, []);
  

  const classes = useStyles();

  return (
    <div className={styles.editAttributesPanel}>
      <Field label={t("Link to")}>
        <div className={classes.linkTo}>
          <Select 
            {...typeField}
            onChange={ev => {
              typeField.onChange(ev);
              const type = parseInt(ev.currentTarget.value, 10);
              formik.setFieldValue("href", defaultHRefForType(type));
            }}
            multiple={undefined} 
          >
            {[
              { label: t('URL'), value: LinkType.URL },
              ...(props.options.capabilities.headings && (props.options.targets.headings.length > 0)
                ? [{ label: t('Heading'), value: LinkType.Heading }]
                : []),
              ...(props.options.targets.ids.length > 0
                ? [{ label: t('ID'), value: LinkType.ID }]
                : [])
            ].map(option => {
              return (
                <option value={option.value} key={option.value}>
                  {option.label || option.value}
                </option>);
            })}
          </Select>
          {type === LinkType.URL ? (
            <Input 
              type="text"
              input={{ ref: autoFocusRef }} 
              {...hrefField} 
              autoFocus={true} 
              autoComplete="off"
            />
          ) : (
            <Select 
              className={classes.linkToSelect}
              {...hrefField} 
              multiple={undefined}
            >
              {suggestionsForType(type).map(option => {
                return (
                  <option value={option.value} key={option.value}>
                    {option.value}
                  </option>);
              })}
            </Select>
          )}
        </div>
      </Field>
      {type !== LinkType.Heading ? <>
         <FormikTextInput name="text" label={t("Text")} />
         <FormikTextInput name="title" label={t("Title/Tooltip")} /> </>
         : undefined
      }
     
    </div>
  );
}

const asLinkType = (linkType: LinkType) : LinkType  => {
  return typeof(linkType) === "string" ? parseInt(linkType, 10) : linkType;
}



const useStyles = makeStyles({
  linkTo: {
    marginBottom: '10px',
    display: 'flex',
    flexDirection: 'row',
    columnGap: '8px',
    "& .fui-Input": {
      flexGrow: 1
    }
  },
  linkToSelect: {
    flexGrow: 1
  }
})
