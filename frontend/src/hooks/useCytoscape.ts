import { useEffect, useRef, type RefObject } from 'react'
import cytoscape, { type Core, type CytoscapeOptions, type ElementDefinition } from 'cytoscape'

/**
 * Mount/update/destroy pattern for a Cytoscape instance, generic enough for the Evidence
 * screen's fund-flow graph (Task 6) to consume. Mounts once per `containerRef` element,
 * re-applies `elements`/`layout` when they change without tearing the instance down, and
 * always destroys the instance on unmount (Cytoscape leaks canvas listeners otherwise).
 */
export interface UseCytoscapeOptions extends Omit<CytoscapeOptions, 'container' | 'elements'> {
  elements?: ElementDefinition[]
}

export function useCytoscape(
  containerRef: RefObject<HTMLElement | null>,
  options: UseCytoscapeOptions,
): RefObject<Core | null> {
  const coreRef = useRef<Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const core = cytoscape({ ...options, container: containerRef.current })
    coreRef.current = core

    return () => {
      core.destroy()
      coreRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/destroy keyed on the container only; use core.json()/batch updates for data changes
  }, [containerRef])

  useEffect(() => {
    const core = coreRef.current
    if (!core) return

    core.batch(() => {
      core.elements().remove()
      core.add(options.elements ?? [])
    })

    if (options.layout) {
      core.layout(options.layout).run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when elements/layout identity changes
  }, [options.elements, options.layout])

  return coreRef
}
