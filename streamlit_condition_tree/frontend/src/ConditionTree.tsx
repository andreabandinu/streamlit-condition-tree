import {ComponentProps, Streamlit, StreamlitComponentBase, withStreamlitConnection} from "streamlit-component-lib"
import React, {ReactNode} from "react"
import _ from 'lodash'

import type {BuilderProps, Config, ImmutableTree, JsonGroup, JsonTree} from '@react-awesome-query-builder/antd';
import {Builder, Query, Utils as QbUtils} from '@react-awesome-query-builder/antd';
import {ConfigProvider, theme as antdTheme} from 'antd';
import '@react-awesome-query-builder/antd/css/styles.css';
import './style.css'
import "@fontsource/source-sans-pro";
import {defaultConfig} from './config'
import {deepMap} from "./utils"

interface State {
    tree: ImmutableTree,
    config: Config,
    expanded: boolean
}

const defaultTree: JsonGroup = {
    type: "group",
    id: QbUtils.uuid()
};


const exportFunctions: Record<string, Function> = {
    queryString: QbUtils.queryString,
    mongodb: QbUtils.mongodbFormat,
    sql: QbUtils.sqlFormat,
    spel: QbUtils.spelFormat,
    elasticSearch: QbUtils.elasticSearchFormat,
    jsonLogic: QbUtils.jsonLogicFormat
}

const formatTree = (tree: any) => {
    // Recursively add uuid and rename 'children' key
    tree.id = QbUtils.uuid()
    if (tree.children) {
        tree.children1 = tree.children;
        delete tree.children;
        tree.children1.forEach(formatTree);
    }
};

const unformatTree = (tree: any) => {
    // Recursively remove uuid and rename 'children1' key
    delete tree.id;
    if (tree.children1) {
        tree.children = tree.children1;
        delete tree.children1;
        tree.children.forEach(unformatTree);
    }
};

const parseJsCodeFromPython = (v: string) => {
    const JS_PLACEHOLDER = "::JSCODE::"

    let funcReg = new RegExp(
        `${JS_PLACEHOLDER}\\s*((function|class)\\s*.*)\\s*${JS_PLACEHOLDER}`
    )

    let match = funcReg.exec(v)

    if (match) {
        const funcStr = match[1]
        // eslint-disable-next-line
        return new Function("return " + funcStr)()
    } else {
        return v
    }
}

class ConditionTree extends StreamlitComponentBase<State> {

    private debouncedSetStreamlitValue: _.DebouncedFunc<(tree: ImmutableTree) => void>;

    public constructor(props: ComponentProps) {
        super(props);

        let userConfig = props.args['config'];
        userConfig = deepMap(userConfig, parseJsCodeFromPython)

        const config: Config = _.merge({}, defaultConfig, userConfig);

        // Load input tree
        let tree: ImmutableTree = QbUtils.loadTree(defaultTree)
        if (props.args['tree'] != null) {
            try {
                let input_tree = props.args['tree']
                formatTree(input_tree)
                tree = QbUtils.checkTree(QbUtils.loadTree(input_tree), config)
            } catch (error) {
                console.error(error);
            }
        }

        this.state = {config, tree, expanded: false}
        this.setStreamlitValue(tree)
      
        // Create a debounced version of setStreamlitValue
        this.debouncedSetStreamlitValue = _.debounce(this.setStreamlitValue, 300);
    }

    public render = (): ReactNode => {
        const {theme} = this.props
        const tree = QbUtils.getTree(this.state.tree)
        const empty = !tree.children1 || !tree.children1.length

        return (
            <div>
                <ConfigProvider
                    theme={theme ? {
                        token: {
                            colorPrimary: theme['primaryColor'],
                            colorText: theme['textColor'],
                            fontFamily: theme['font'],
                            fontSize: 16,
                            controlHeight: 38,
                        },
                        algorithm: theme['base'] === 'dark' ?
                            antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
                    } : {}}
                >
                    <Query
                        {...this.state.config}
                        value={this.state.tree}
                        onChange={this.onChange}
                        renderBuilder={this.renderBuilder}
                    />
                    <p>{empty && this.props.args['placeholder']}</p>
                </ConfigProvider>
            </div>
        )
    }
    
    componentDidMount = () => {
        this.setHeight()
    }

    componentDidUpdate = () => {
        // ... (existing code for CSS class)
    
        // Check if the tree has changed
        const currentTree = QbUtils.getTree(this.state.tree)
        const isEmpty = !currentTree.children1 || !currentTree.children1.length
    
        if (!isEmpty && !this.state.expanded) {
            this.setState({ expanded: true }, this.setHeight)
        } else {
            this.setHeight()
        }
    }

    componentWillUnmount = () => {
        this.debouncedSetStreamlitValue.cancel();
    }

    private setHeight = () => {
        // Set frame height
        const height = Math.max(
            document.body.scrollHeight + 20,
            this.state.expanded ? this.props.args['min_height'] : 150
        );
        Streamlit.setFrameHeight(height);
    }

    private onChange = (immutableTree: ImmutableTree) => {
        this.setState({tree: immutableTree})
        this.debouncedSetStreamlitValue(immutableTree)
  }

    private setStreamlitValue = (tree: ImmutableTree) => {
        const exportFunc = exportFunctions[this.props.args['return_type']]
        const exportValue = exportFunc ? exportFunc(tree, this.state.config) : ''

        let output_tree: JsonTree = QbUtils.getTree(tree)
        unformatTree(output_tree)
        Streamlit.setComponentValue([output_tree, exportValue])
    }

    private renderBuilder = (props: BuilderProps) => (
        <div className="query-builder-container">
            <div className={'query-builder ' +
                (this.props.args['always_show_buttons'] ? '' : 'qb-lite')}>
                <Builder {...props} />
            </div>
        </div>
    )
}

export default withStreamlitConnection(ConditionTree);
