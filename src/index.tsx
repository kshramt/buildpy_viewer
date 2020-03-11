import React from "react";
import ReactDOM from "react-dom";
import { connect, Provider } from "react-redux";
import { Action, Dispatch, createStore } from "redux";
import produce, { setAutoFreeze } from "immer";

import "./index.css";

setAutoFreeze(false); // Refs in the cache should not be frozen.

const API_VERSION = "v1";

const SPACES_RE = /\s+/;

interface IHistory {
  prev: null | IHistory;
  curr: IState;
  next: null | IHistory;
}

interface IState {
  job_list: IJobText[];
  jobs_of_t: {
    [k: string]: IJobText[];
  };
  jobs_of_d: {
    [k: string]: IJobText[];
  };
  selector_list: string[];
  selected: null | number;
}

interface IJob {
  data: TContainer;
  desc: null | string;
  ds: TStringContainer;
  i: number;
  key: null | TStringContainer;
  priority: number;
  serial: boolean;
  successed: boolean;
  t: string;
  ts: TStringContainer;
}

interface IJobText {
  id: number;
  ts: string[];
  ds: string[];
  text: string;
}

type TStringContainer =
  | string
  | {
      [k: string]: string | TStringContainer;
    }
  | TStringContainer[];

type TContainer =
  | null
  | number
  | boolean
  | string
  | {
      [k: string]: string | TContainer;
    }
  | TContainer[];

interface IUpdateSelectorAction extends Action {
  type: "update_selector";
  i: number;
  selector: string;
}

interface IDeleteSelectorAction extends Action {
  type: "delete_selector";
  i: number;
}

interface IAddSelectorAction extends Action {
  type: "add_selector";
}

interface IUndoAction extends Action {
  type: "undo";
}

interface IRedoAction extends Action {
  type: "redo";
}

interface ISelectAction extends Action {
  type: "select";
  id: null | number;
}

type TActions =
  | IUpdateSelectorAction
  | IDeleteSelectorAction
  | IAddSelectorAction
  | IUndoAction
  | IRedoAction
  | ISelectAction;

function* iterate_string_container(
  x: TStringContainer,
): Generator<string, any, undefined> {
  if (typeof x === "string") {
    yield x;
  } else if (Array.isArray(x)) {
    for (const k in x) {
      yield* iterate_string_container(x[k]);
    }
  } else {
    for (const k in x) {
      yield* iterate_string_container(x[k]);
    }
  }
}

const assert = (v: boolean, msg: string) => {
  if (!v) {
    throw new Error(msg);
  }
};

const select = (e: React.ChangeEvent<HTMLInputElement>, id: number) => ({
  type: "select" as const,
  id,
});

const update_selector = (
  e: React.ChangeEvent<HTMLInputElement>,
  i: number,
) => ({
  type: "update_selector" as const,
  i,
  selector: e.currentTarget.value,
});

const delete_selector = (i: number) => ({
  type: "delete_selector" as const,
  i,
});

const add_selector = () => ({
  type: "add_selector" as const,
});

const undo = () => ({
  type: "undo" as const,
});

const redo = () => ({
  type: "redo" as const,
});

function* expand_job_list(
  job_list: IJobText[],
  jobs_of_t: { [k: string]: IJobText[] },
  jobs_of_d: { [k: string]: IJobText[] },
  seen: Set<IJobText>,
  job_set_max: Set<IJobText>,
  upward: boolean,
  downward: boolean,
): Generator<IJobText, any, undefined> {
  for (const j of job_list) {
    if (job_set_max.has(j) && !seen.has(j)) {
      seen.add(j);
      yield j;
      if (upward) {
        for (const t of j.ts) {
          if (t in jobs_of_d) {
            yield* expand_job_list(
              jobs_of_d[t],
              jobs_of_t,
              jobs_of_d,
              seen,
              job_set_max,
              true,
              false,
            );
          }
        }
      }
      if (downward) {
        for (const d of j.ds) {
          yield* expand_job_list(
            jobs_of_t[d],
            jobs_of_t,
            jobs_of_d,
            seen,
            job_set_max,
            false,
            true,
          );
        }
      }
    }
  }
}

const filter_job_list = (state: IState) => {
  let job_list = state.job_list;
  for (const selector of state.selector_list) {
    const ws = selector.split(SPACES_RE);
    job_list = Array.from(
      expand_job_list(
        job_list.filter(j => ws.every(w => j.text.includes(w))),
        state.jobs_of_t,
        state.jobs_of_d,
        new Set(),
        new Set(job_list),
        true,
        true,
      ),
    );
  }
  return job_list;
};

const expand_up_or_down = (
  ret: IJobText[][],
  job: IJobText,
  jobs_of_t_or_d: {
    [k: string]: IJobText[];
  },
  offset: number,
  seen: Set<IJobText>,
  up: boolean,
) => {
  if (seen.has(job)) {
    return;
  }
  if (ret.length <= offset) {
    ret.push([]);
  }
  ret[offset].push(job);
  seen.add(job);
  for (const x of up ? job.ts : job.ds) {
    if (x in jobs_of_t_or_d) {
      for (const j of jobs_of_t_or_d[x]) {
        expand_up_or_down(ret, j, jobs_of_t_or_d, offset + 1, seen, up);
      }
    }
  }
};

const Node = connect(
  (
    state: IState,
    ownProps: {
      id: number;
    },
  ) => {
    return {
      job: state.job_list[ownProps.id],
      selected: state.selected === ownProps.id,
    };
  },
  (
    dispatch: Dispatch<TActions>,
    ownProps: {
      id: number;
    },
  ) => ({
    select: (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch(select(e, ownProps.id)),
  }),
)(
  (props: {
    job: IJobText;
    selected: boolean;
    select: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <li className={props.selected ? "selected" : undefined}>
      <input type="checkbox" checked={props.selected} onChange={props.select} />
      {props.job.text}
    </li>
  ),
);

const List = connect((state: IState) => {
  const job_list = filter_job_list(state);
  return {
    job_list,
  };
})((props: { job_list: IJobText[] }) => (
  <div id="list">
    <ol>
      {props.job_list.map(j => (
        <Node key={j.id} id={j.id} />
      ))}
    </ol>
  </div>
));

const focusInput = (e: HTMLInputElement) => {
  if (e !== null) {
    e.focus();
  }
};

const Selector = connect(
  (
    state: IState,
    ownProps: {
      i: number;
    },
  ) => {
    return {
      selector: state.selector_list[ownProps.i],
      focus: ownProps.i === 0 ? focusInput : undefined,
    };
  },
  (
    dispatch: Dispatch<TActions>,
    ownProps: {
      i: number;
    },
  ) => ({
    update_selector: (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch(update_selector(e, ownProps.i)),
    delete_selector: () => dispatch(delete_selector(ownProps.i)),
  }),
)(
  (props: {
    selector: string;
    focus: undefined | ((e: HTMLInputElement) => void);
    update_selector: (e: React.ChangeEvent<HTMLInputElement>) => void;
    delete_selector: () => void;
  }) => {
    return (
      <React.Fragment>
        <input
          className="selector"
          value={props.selector}
          onChange={e => props.update_selector(e)}
          ref={props.focus}
        />
        <button onClick={props.delete_selector}>×</button>
      </React.Fragment>
    );
  },
);

const Selectors = connect(
  (state: IState) => ({
    n_selector_list: state.selector_list.length,
  }),
  (dispatch: Dispatch<TActions>) => ({
    add_selector: () => dispatch(add_selector()),
  }),
)((props: { n_selector_list: number; add_selector: () => void }) => (
  <div id="selectors">
    <button onClick={props.add_selector}>+</button>
    {[...Array(props.n_selector_list).keys()].map(i => (
      <Selector i={i} key={props.n_selector_list - i} />
    ))}
  </div>
));

const Menu = connect(
  (
    state: IState,
    ownProps: {
      selected: boolean;
    },
  ) => ownProps,
  (dispatch: Dispatch<TActions>) => ({
    undo: () => dispatch(undo()),
    redo: () => dispatch(redo()),
  }),
)((props: { selected: boolean; undo: () => void; redo: () => void }) => (
  <div id="menu">
    <button onClick={props.undo}>⬅</button>
    <button onClick={props.redo}>➡</button>
    {props.selected ? null : <Selectors />}
  </div>
));

const Column = connect(
  (
    state: IState,
    ownProp: {
      column: IJobText[];
    },
  ) => {
    return ownProp;
  },
)((props: { column: IJobText[] }) => {
  return (
    <div className="column">
      <ol>
        {props.column.map(job => (
          <Node key={job.id} id={job.id} />
        ))}
      </ol>
    </div>
  );
});

const Columns = connect(
  (
    state: IState,
    ownProps: {
      selected: number;
    },
  ) => {
    const up_cols = [] as IJobText[][];
    const job = state.job_list[ownProps.selected];
    expand_up_or_down(
      up_cols,
      job,
      state.jobs_of_d,
      0,
      new Set<IJobText>(),
      true,
    );
    const down_cols = [] as IJobText[][];
    expand_up_or_down(
      down_cols,
      job,
      state.jobs_of_t,
      0,
      new Set<IJobText>(),
      false,
    );
    const columns = up_cols.reverse().concat(down_cols.slice(1));
    return {
      columns,
    };
  },
)((props: { columns: IJobText[][] }) => (
  <div id="columns">
    {props.columns.map((column, i) => (
      <Column key={i} column={column} />
    ))}
  </div>
));

const App = connect((state: IState) => ({
  selected: state.selected,
}))((props: { selected: null | number }) => (
  <React.Fragment>
    <Menu selected={props.selected !== null} />
    <div id="display">
      {props.selected === null ? (
        <List />
      ) : (
        <Columns selected={props.selected} />
      )}
    </div>
  </React.Fragment>
));

const push_history = (history: IHistory, state: IState) =>
  (history.next = {
    prev: history,
    curr: state,
    next: null,
  });

const root_reducer_of = (state_: IState) => {
  let history = {
    prev: null,
    curr: state_,
    next: null,
  } as IHistory;
  const save_history = (state: IState) => {
    if (state !== history.curr) {
      history = push_history(history, state);
    }
    return state;
  };
  return (state: undefined | IState, action: TActions) => {
    if (state === undefined) {
      return state_;
    } else {
      switch (action.type) {
        case "add_selector":
          return save_history(
            produce(state, draft => {
              draft.selector_list.unshift("");
            }),
          );
        case "update_selector":
          return save_history(
            produce(state, draft => {
              draft.selector_list[action.i] = action.selector;
            }),
          );
        case "delete_selector":
          return save_history(
            produce(state, draft => {
              draft.selector_list.splice(action.i, 1);
            }),
          );
        case "select":
          return save_history(
            produce(state, draft => {
              draft.selected = draft.selected === action.id ? null : action.id;
            }),
          );
        case "undo":
          if (history.prev !== null) {
            history = history.prev;
            state = history.curr;
          }
          return state;
        case "redo":
          if (history.next !== null) {
            history = history.next;
            state = history.curr;
          }
          return state;
        default:
          const _: never = action; // 1 or state cannot be used here
          return state;
      }
    }
  };
};

const run = (data: IJob[]) => {
  const job_list = data.map((j, i) => ({
    id: i,
    ts: Array.from(new Set(iterate_string_container(j.ts))),
    ds: Array.from(new Set(iterate_string_container(j.ds))),
    text: JSON.stringify(j),
  }));
  const jobs_of_t = {} as {
    [k: string]: IJobText[];
  };
  const jobs_of_d = {} as {
    [k: string]: IJobText[];
  };
  for (const j of job_list) {
    for (const t of j.ts) {
      if (t in jobs_of_t) {
        jobs_of_t[t].push(j);
      } else {
        jobs_of_t[t] = [j];
      }
    }
    for (const d of j.ds) {
      if (d in jobs_of_d) {
        jobs_of_d[d].push(j);
      } else {
        jobs_of_d[d] = [j];
      }
    }
  }
  const state = {
    job_list,
    jobs_of_t,
    jobs_of_d,
    selector_list: [""],
    selected: null,
  };
  const store = createStore(root_reducer_of(state), state);
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
};

const main = () => {
  fetch("api/" + API_VERSION + "/get")
    .then(r => r.json())
    .then((data: IJob[]) => {
      ReactDOM.render(run(data), document.getElementById("root"));
    });
};

main();
