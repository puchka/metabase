import { useRegisterActions, useKBar } from "kbar";
import { useMemo, useState } from "react";
import { push } from "react-router-redux";
import { useDebounce } from "react-use";
import { t } from "ttag";

import { getAdminPaths } from "metabase/admin/app/selectors";
import { getSectionsWithPlugins } from "metabase/admin/settings/selectors";
import { useListRecentItemsQuery, useSearchQuery } from "metabase/api";
import { ROOT_COLLECTION } from "metabase/entities/collections";
import Search from "metabase/entities/search";
import { SEARCH_DEBOUNCE_DURATION } from "metabase/lib/constants";
import { getIcon } from "metabase/lib/icon";
import { getName } from "metabase/lib/name";
import { useDispatch, useSelector } from "metabase/lib/redux";
import * as Urls from "metabase/lib/urls";
import { closeModal } from "metabase/redux/ui";
import {
  getDocsSearchUrl,
  getDocsUrl,
  getSettings,
} from "metabase/selectors/settings";
import { getShowMetabaseLinks } from "metabase/selectors/whitelabel";

import type { PaletteAction } from "../types";

export const useCommandPalette = () => {
  const dispatch = useDispatch();
  const docsUrl = useSelector(state => getDocsUrl(state, {}));
  const showMetabaseLinks = useSelector(getShowMetabaseLinks);

  // Used for finding actions within the list
  const { searchQuery } = useKBar(state => ({
    searchQuery: state.searchQuery,
  }));
  const trimmedQuery = searchQuery.trim();

  // Used for finding objects across the Metabase instance
  const [debouncedSearchText, setDebouncedSearchText] = useState(trimmedQuery);

  useDebounce(
    () => {
      setDebouncedSearchText(trimmedQuery);
    },
    SEARCH_DEBOUNCE_DURATION,
    [trimmedQuery],
  );

  const hasQuery = searchQuery.length > 0;

  const {
    currentData: searchResults,
    isFetching: isSearchLoading,
    error: searchError,
  } = useSearchQuery(
    {
      q: debouncedSearchText,
      limit: 20,
    },
    {
      skip: !debouncedSearchText,
      refetchOnMountOrArgChange: true,
    },
  );

  const { data: recentItems } = useListRecentItemsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const adminPaths = useSelector(getAdminPaths);
  const settingValues = useSelector(getSettings);
  const settingsSections = useMemo<Record<string, any>>(
    () => getSectionsWithPlugins(),
    [],
  );

  const docsAction = useMemo<PaletteAction[]>(() => {
    const ret: PaletteAction[] = [
      {
        id: "search_docs",
        name: debouncedSearchText
          ? `Search documentation for "${debouncedSearchText}"`
          : t`View documentation`,
        section: "docs",
        keywords: debouncedSearchText, // Always match the debouncedSearchText string
        icon: "document",
        perform: () => {
          if (debouncedSearchText) {
            window.open(getDocsSearchUrl({ debouncedSearchText }));
          } else {
            window.open(docsUrl);
          }
        },
      },
    ];
    return ret;
  }, [debouncedSearchText, docsUrl]);

  const showDocsAction = showMetabaseLinks && hasQuery;

  useRegisterActions(showDocsAction ? docsAction : [], [
    docsAction,
    showDocsAction,
  ]);

  const searchResultActions = useMemo<PaletteAction[]>(() => {
    if (isSearchLoading) {
      return [
        {
          id: "search-is-loading",
          name: "Loading...",
          keywords: searchQuery,
          section: "search",
        },
      ];
    } else if (searchError) {
      return [
        {
          id: "search-error",
          name: t`Could not load search results`,
          section: "search",
        },
      ];
    } else if (debouncedSearchText) {
      if (searchResults?.data?.length) {
        return searchResults.data.map(result => {
          const wrappedResult = Search.wrapEntity(result, dispatch);
          return {
            id: `search-result-${result.model}-${result.id}`,
            name: result.name,
            icon: wrappedResult.getIcon().name,
            section: "search",
            keywords: debouncedSearchText,
            subtitle: result.description || "",
            perform: () => {
              dispatch(closeModal());
              dispatch(push(wrappedResult.getUrl()));
            },
            extra: {
              parentCollection: wrappedResult.getCollection().name,
              isVerified: result.moderated_status === "verified",
              database: result.database_name,
            },
          };
        });
      } else {
        return [
          {
            id: "no-search-results",
            name: t`No results for “${debouncedSearchText}”`,
            keywords: debouncedSearchText,
            section: "search",
          },
        ];
      }
    }
    return [];
  }, [
    dispatch,
    debouncedSearchText,
    searchQuery,
    isSearchLoading,
    searchError,
    searchResults,
  ]);

  useRegisterActions(searchResultActions, [searchResultActions]);

  const recentItemsActions = useMemo<PaletteAction[]>(() => {
    return (
      recentItems?.map(item => ({
        id: `recent-item-${getName(item.model_object)}`,
        name: getName(item.model_object),
        icon: getIcon(item).name,
        section: "recent",
        perform: () => {
          dispatch(push(Urls.modelToUrl(item) ?? ""));
        },
        extra:
          item.model === "table"
            ? {
                database: item.model_object.database_name,
              }
            : {
                parentCollection:
                  item.model_object.collection_id === null
                    ? ROOT_COLLECTION.name
                    : item.model_object.collection_name,
                isVerified: item.model_object.moderated_status === "verified",
              },
      })) || []
    );
  }, [dispatch, recentItems]);

  useRegisterActions(hasQuery ? [] : recentItemsActions, [
    recentItemsActions,
    hasQuery,
  ]);

  const adminActions = useMemo<PaletteAction[]>(() => {
    return adminPaths.map(adminPath => ({
      id: `admin-page-${adminPath.key}`,
      name: `${adminPath.name}`,
      icon: "gear",
      perform: () => dispatch(push(adminPath.path)),
      section: "admin",
    }));
  }, [adminPaths, dispatch]);

  const adminSettingsActions = useMemo<PaletteAction[]>(() => {
    return Object.entries(settingsSections)
      .filter(([slug, section]) => {
        if (section.getHidden?.(settingValues)) {
          return false;
        }

        return !slug.includes("/");
      })
      .map(([slug, section]) => ({
        id: `admin-settings-${slug}`,
        name: `Settings - ${section.name}`,
        icon: "gear",
        perform: () => dispatch(push(`/admin/settings/${slug}`)),
        section: "admin",
      }));
  }, [settingsSections, settingValues, dispatch]);

  useRegisterActions(
    hasQuery ? [...adminActions, ...adminSettingsActions] : [],
    [adminActions, adminSettingsActions, hasQuery],
  );
};
