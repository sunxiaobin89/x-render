import {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEventListener, useMemoizedFn } from 'ahooks';
import produce, { setAutoFreeze } from 'immer';
import { debounce } from 'lodash';
import type { FC } from 'react';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import CandidateNode from './components/CandidateNode';
import CustomEdge from './components/CustomEdge';
import PanelContainer from './components/PanelContainer';
import { useEventEmitterContextContext } from './models/event-emitter';

import CustomNodeComponent from './components/CustomNode';
import { useStore, useStoreApi } from './hooks/useStore';

import Operator from './operator';
import FlowProps from './types';
import { uuid } from './utils';
import autoLayoutNodes from './utils/autoLayoutNodes';

import { shallow } from 'zustand/shallow';
import NodeEditor from './components/NodeEditor';
import './index.less';
import { useTemporalStore } from './hooks/useTemporalStore';

const CustomNode = memo(CustomNodeComponent);
const edgeTypes = { buttonedge: memo(CustomEdge) };

/***
 *
 * XFlow 入口
 *
 */
const XFlow: FC<FlowProps> = memo(() => {
  const workflowContainerRef = useRef<HTMLDivElement>(null);
  const store = useStoreApi();
  const { zoomTo } = useReactFlow();
  const {
    layout,
    nodes,
    edges,
    setNodes,
    setEdges,
    panOnDrag,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setCandidateNode,
    isAddingNode,
    setMousePosition,
  } = useStore(
    s => ({
      nodes: s.nodes,
      edges: s.edges,
      setNodes: s.setNodes,
      setEdges: s.setEdges,
      layout: s.layout,
      panOnDrag: s.panOnDrag,
      setMousePosition: s.setMousePosition,
      isAddingNode: s.isAddingNode,
      setCandidateNode: s.setCandidateNode,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
    }),
    shallow
  );
  const { record } = useTemporalStore();
  const [activeNode, setActiveNode] = useState<any>(null);
  useEffect(() => {
    zoomTo(0.8);
    setAutoFreeze(false);
    return () => {
      setAutoFreeze(true);
    };
  }, []);

  useEventListener('keydown', e => {
    if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey))
      e.preventDefault();
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey))
      e.preventDefault();
    if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey))
      e.preventDefault();
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey))
      e.preventDefault();
  });

  useEventListener('mousemove', e => {
    const containerClientRect =
      workflowContainerRef.current?.getBoundingClientRect();
    if (containerClientRect) {
      setMousePosition({
        pageX: e.clientX,
        pageY: e.clientY,
        elementX: e.clientX - containerClientRect.left,
        elementY: e.clientY - containerClientRect.top,
      });
    }
  }, {
    target: workflowContainerRef.current,
    enable: isAddingNode
  });

  const { eventEmitter } = useEventEmitterContextContext();
  eventEmitter?.useSubscription((v: any) => {
    // 整理节点
    if (v.type === 'auto-layout-nodes') {
      const newNodes: any = autoLayoutNodes(store.getState().nodes, edges);
      setNodes(newNodes);
    }

    if (v.type === 'deleteNode') {
      setActiveNode(null);
    }
  });

  // 新增节点
  const handleAddNode = (data: any) => {
    const newNode = {
      id: uuid(),
      type: 'custom',
      data,
      position: {
        x: 0,
        y: 0,
      },
    };
    setCandidateNode(newNode);
  };

  // 插入节点
  // const handleInsertNode = () => {
  //   const newNode = {
  //     id: uuid(),
  //     data: { label: 'new node' },
  //     position: {
  //       x: 0,
  //       y: 0,
  //     },
  //   };
  //   addNodes(newNode);
  //   addEdges({
  //     id: uuid(),
  //     source: '2',
  //     target: newNode.id,
  //   });
  //   const targetEdge = edges.find(edge => edge.source === '2');
  //   updateEdge(targetEdge?.id as string, {
  //     source: newNode.id,
  //   });
  // };

  // edge 移入/移出效果
  const getUpdateEdgeConfig = useMemoizedFn((edge: any, color: string) => {
    const newEdges = produce(edges, draft => {
      const currEdge: any = draft.find(e => e.id === edge.id);
      currEdge.style = {
        ...edge.style,
        stroke: color,
      };
      currEdge.markerEnd = {
        ...edge?.markerEnd,
        color,
      };
    });
    setEdges(newEdges);
  });

  const handleNodeValueChange = debounce((data: any) => {
    for (let node of nodes) {
      if (node.id === data.id) {
        node.data = {
          ...node?.data,
          ...data?.values,
        };
        break;
      }
    }
    setNodes([...nodes]);
  }, 200);

  const nodeTypes = useMemo(() => {
    return {
      custom: (props: any) => {
        const { data, id, ...rest } = props;
        const { _nodeType, ...restData } = data || {};

        return (
          <CustomNode
            {...rest}
            id={id}
            data={{ ...restData }}
            type={_nodeType}
            layout={layout}
            onClick={e => {
              setActiveNode({ id, _nodeType, values: { ...restData } });
            }}
          />
        );
      },
    };
  }, [layout]);

  const NodeEditorWrap = useMemo(() => {
    return (
      <NodeEditor
        data={activeNode?.values}
        onChange={handleNodeValueChange}
        nodeType={activeNode?._nodeType}
        id={activeNode?.id}
      />
    );
  }, [activeNode?.id]);

  return (
    <div id="xflow-container" ref={workflowContainerRef}>
      <ReactFlow
        panOnDrag={panOnDrag}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={nodes}
        edges={edges}
        minZoom={0.3}
        defaultEdgeOptions={{
          type: 'buttonedge',
          style: {
            strokeWidth: 1.5, // 线粗细
          },
          markerEnd: {
            type: MarkerType.ArrowClosed, // 箭头
          },
        }}
        onConnect={onConnect}
        onNodesChange={changes => {
          changes.forEach(change => {
            if (change.type === 'remove' || change.type === 'add') {
              record(() => {
                onNodesChange(changes);
              })
            } else {
              onNodesChange(changes);
            }
          })
        }}
        onEdgesChange={changes => {
          onEdgesChange(changes);
        }}
        onEdgeMouseEnter={(_, edge: any) => {
          getUpdateEdgeConfig(edge, '#2970ff');
        }}
        onEdgeMouseLeave={(_, edge) => {
          getUpdateEdgeConfig(edge, '#c9c9c9');
        }}
        onNodesDelete={() => {
          // setActiveNode(null);
        }}
      >
        <CandidateNode />
        <Operator addNode={handleAddNode} xflowRef={workflowContainerRef} />
        <Background
          gap={[16, 16]}
          size={0.6}
          color="black"
          variant={BackgroundVariant.Dots}
        />
        {activeNode && (
          <PanelContainer
            id={activeNode?.id}
            nodeType={activeNode?._nodeType}
            onClose={() => setActiveNode(null)}
            node={activeNode}
            data={activeNode?.values}
            // disabled
          >
            {NodeEditorWrap}
          </PanelContainer>
        )}
      </ReactFlow>
    </div>
  );
});

export default XFlow;
